// This JS files contains the main functions for a bivariate choropleth map
// that displays health outcomes and health risk behaviors for each county in Louisiana.
// It uses D3.js to create the map and handle user interactions.

//Wrap everything in a self-executing anonymous function to move to local scope
(function(){
 
    //pseudo-global variables 
    var attrArray = ["teeth_lost", 
      "arthritis", 
      "cancer",
      "copd",
      "heart_disease",
      "asthma",
      "depression",
      "diabetes",
      "high_blood_pressure",
      "high_cholesterol",
      "obesity",
      "stroke",
      "binge_drinking",
      "smoking",
      "physical_inactivity",
      "short_sleep_duration"]; // list of attributes
    // Set initial variables
    var initialFirstVariable = attrArray[7]; // diabetes
    var initialSecondVariable = attrArray[15]; // short_sleep_duration
  
    //begin script when window loads
    window.onload = setMap();
    
    //set up choropleth map
    function setMap(){
    
      //map frame dimensions
      var width = 800,
      height = 600;
    
      // Create new svg container for the main U.S. map
      var louisianaMap = d3.select("#louisianaMap") 
        .append("svg")
        .attr("class", "louisianaMap")
        .attr("d", path) 
        .attr("width", width)
        .attr("height", height);
    
      // Set main map projection to Albers and position it on Llouisiana
      var projection = d3.geoAlbers()
            .center([0, 30.77])
            .rotate([91.81, 0, 0])
            .parallels([33.17, 28.94])
            .scale(4000)
            .translate([width / 2, height / 2]);
    
      // Set spatial data path
      var path = d3.geoPath()
        .projection(projection);
    
      //use Promise.all to parallelize asynchronous data loading
      var promises = [];    
        promises.push(d3.csv("data/public_health_data.csv")); //load attributes from csv    
        promises.push(d3.json("data/countiesNew.topojson")); //load counties spatial data, includes counties and CT COGS
        //promises.push(d3.json("data/states.topojson")); // load states spatial data
        Promise.all(promises).then(callback);
  
        function callback(data) {
            var csvData = data[0], counties = data[1]; 
            //states = data[2];
            
            // Filter counties and states for Llouisiana only
            var louisianaCounties = topojson.feature(counties, counties.objects.countiesNew2).features.filter(function(d) {
                return d.properties.REGION === "LA";
            });

            //join csv data to GeoJSON enumeration units
            louisianaCounties = joinData(louisianaCounties, csvData);
            //examine the results
            console.log(louisianaCounties);
            
            // Call makeColorScale to create the initial color scale
            var colorScale = makeColorScale(csvData, initialFirstVariable, initialSecondVariable); 
            
            //add enumeration units to the map
            setEnumerationUnits(louisianaCounties, louisianaMap, path, colorScale, initialFirstVariable, initialSecondVariable);

        };

    }; //end of setMap()
    
    function joinData(louisianaCounties, csvData){
      //loop through csv to assign each set of csv attribute values to geojson county
      for (var i=0; i<csvData.length; i++){
          var csvCounty = csvData[i]; //the current county
          csvKey = csvCounty.id;
    
          //loop through geojson counties to find correct county id
          for (var a=0; a<louisianaCounties.length; a++){
    
              var geojsonProps = louisianaCounties[a].properties; //the current county geojson properties
              var geojsonKey = geojsonProps.CODE_LOCAL; //the geojson primary key
    
              //where primary keys match, transfer csv data to geojson properties object
              if (geojsonKey == csvKey){  
                  //assign all attributes and values
                  attrArray.forEach(function(attr){
                      var val = parseFloat(csvCounty[attr]); //get csv attribute value
                      geojsonProps[attr] = val; //assign attribute and value to geojson properties
                  });
              };
          };
      }
      return louisianaCounties;
    }; // end of function joinData
    
    // create color scale generator
    function makeColorScale(csvData, firstVariable, secondVariable) {
      // Create quintile breaks for each variable
      var numQuintiles = 5;
      var numColors = 3;
      var firstValues = [];
      var secondValues = [];
      for (let i = 0; i < csvData.length; i++) {
        var dataPoint = csvData[i];
        firstValues.push(parseFloat(dataPoint[firstVariable]));
        secondValues.push(parseFloat(dataPoint[secondVariable]));
      }
      // Sort the values to ensure correct quintile calculation
      firstValues.sort(d3.ascending);
      secondValues.sort(d3.ascending);
      var firstQuintiles = d3.scaleQuantile()
        .domain(firstValues)
        .range(d3.range(numQuintiles));
    
      var secondQuintiles = d3.scaleQuantile()
        .domain(secondValues)
        .range(d3.range(numQuintiles));
    
      // Map quintiles to a range of three
      var mapToThree = (value) => Math.floor(value / (numQuintiles / numColors));
    
      // Create a bivariate color scale based on the mapped values
      var bivariateColorScale = d3.scaleOrdinal()
        .domain([
          "0,0", "0,1", "0,2",
          "1,0", "1,1", "1,2",
          "2,0", "2,1", "2,2"
        ]) // domain of all possible combinations of quintiles
        .range([
          "#e8e8e8", "#ace4e4", "#5ac8c8",
          "#dfb0d6", "#a5add3", "#5698b9",
          "#be64ac", "#8c62aa", "#3b4994"
        ]); // range of colors using blue-purple color scheme
    
      return (d) => {
        var firstQuintile = firstQuintiles(d[firstVariable]);
        var secondQuintile = secondQuintiles(d[secondVariable]);
        var mappedFirstQuintile = mapToThree(firstQuintile);
        var mappedSecondQuintile = mapToThree(secondQuintile);
        var quintilePair = [mappedFirstQuintile, mappedSecondQuintile];
        //console.log(`First quintile for ${d.CODE_LOCAL}:`, firstQuintile); // Use for debugging
        //console.log(`Second quintile for ${d.CODE_LOCAL}:`, secondQuintile); // Use for debugging
        //console.log(`Mapped first quintile for ${d.CODE_LOCAL}:`, mappedFirstQuintile); // Use for debugging
        //console.log(`Mapped second quintile for ${d.CODE_LOCAL}:`, mappedSecondQuintile); // Use for debugging
        //console.log(`Quintile pair for ${d.CODE_LOCAL}:`, quintilePair); // Use for debugging
        return bivariateColorScale(quintilePair.join(","));
      };
    };
    
    
    // Create enumeration units
    function setEnumerationUnits(louisianaCounties, louisianaMap, path, colorScale, firstVariable, secondVariable){
      //add counties to map
      var enumerationUnits = louisianaMap.selectAll(".counties")
          .data(louisianaCounties)
          .enter()
          .append("path")
          .attr("class", function(d){
              var className = "counties " + d.properties.NAME_ALT.replace("'", "\\'");
              return className; // debugs syntax error for counties containing single quote like O'Brien
          })
          .attr("d", path)
          .style("fill", function(d) {
            var combinedValue = [d.properties[firstVariable], d.properties[secondVariable]];
            if (d.properties[firstVariable] != null && d.properties[secondVariable] != null) {
              var color = colorScale(d.properties);
              return color;
            } else {
              console.warn("Missing or invalid value for:", d.properties.CODE_LOCAL);
              return "#ccc";
            }
          })
          .each(function(d) {
              // Save the initial styles in a <desc> element
              var initialStyle = {
                  stroke: d3.select(this).style("stroke"),
                  "stroke-width": d3.select(this).style("stroke-width")
              };
              d3.select(this).append("desc").text(JSON.stringify(initialStyle));
          })
          .on("mouseover", function(event, d){
              highlight(d.properties, firstVariable, secondVariable);
          })
          .on("mouseout", function(event, d){
              dehighlight(d.properties);
          })
          .on("mousemove", moveLabel);       
    };  // end of function setEnumerationUnits
    
      
    // create dynamic label
    function setLabel(props, firstVariable, secondVariable){
      //label content
      var labelAttribute = `
        <h1>${props[firstVariable].toFixed(2)}%</h1>
        <b>${firstVariable}</b><br>
        <h1>${props[secondVariable].toFixed(2)}%</h1>
        <b>${secondVariable}</b><br>
        <h1>${props.NAME_ALT}, ${props.REGION}</h1>`;
    
      //create info label div
      var infolabel = d3.select("body")
          .append("div")
          .attr("class", "infolabel")
          .html(labelAttribute);
    
    }; // end of function setLabel
    
    //function to move info label with mouse
    function moveLabel(event){
      //get width of label
      var labelWidth = d3.select(".infolabel")
          .node()
          .getBoundingClientRect()
          .width;
    
      //use coordinates of mousemove event to set label coordinates
      var x1 = event.clientX + window.scrollX + 10;
      var y1 = event.clientY + window.scrollY - 75;
      var x2 = event.clientX - labelWidth - 10;
      var y2 = event.clientY + 25;
    
      //horizontal label coordinate, testing for overflow
      var x = event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1; 
      //vertical label coordinate, testing for overflow
      var y = event.clientY < 75 ? y2 : y1; 
    
      d3.select(".infolabel")
          .style("left", x + "px")
          .style("top", y + "px");
    }; // end of function moveLabel
        
    //function to highlight enumeration units
    function highlight(props, firstVariable, secondVariable){
      //change stroke
      var className = props.NAME_ALT.replace("'", "\\'");
      var selected = d3.selectAll("." + className); // debug syntax error for counties containing single quote like O'Brien
      selected.style("stroke", "black")
              .style("stroke-width", "2");
      setLabel(props, firstVariable, secondVariable);
  }; // end of function highlight
  
  //function to reset the element style on mouseout
  function dehighlight(props){
      var className = props.NAME_ALT.replace("'", "\\'");
      var selected = d3.selectAll("." + className); // debug syntax error for counties containing single quote like O'Brien
      selected.style("stroke", function(){
                  return getStyle(this, "stroke");
              })
              .style("stroke-width", function(){
                  return getStyle(this, "stroke-width");
              });
  
      function getStyle(element, styleName){
          var styleText = d3.select(element)
              .select("desc")
              .text();
  
          var styleObject = JSON.parse(styleText);
  
          return styleObject[styleName];
      };
      //remove info label
      d3.select(".infolabel").remove();
  }; // end of function dehighlight
  
    
    })();