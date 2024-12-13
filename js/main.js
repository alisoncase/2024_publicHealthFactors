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
  var initialFirstVariable = attrArray[10];
  var initialSecondVariable = attrArray[14];

  //begin script when window loads
  window.onload = setMap();
  
  //set up choropleth map
  function setMap(){
  
    //map frame dimensions
    var width = 800,
    height = 600;
  
    // Create new svg container for the main U.S. map
    var mainMap = d3.select("body") 
      .append("svg")
      .attr("class", "mainMap")
      .attr("d", path) 
      .attr("width", width)
      .attr("height", height);
  
    // Set main map projection to U.S. Albers to position HI and AK below CONUS
    var projection = d3.geoAlbersUsa()
      .scale(1100)
      .translate([width / 2, height / 2]);
  
    // Set spatial data path
    var path = d3.geoPath()
      .projection(projection);
  
    //use Promise.all to parallelize asynchronous data loading
    var promises = [];    
      promises.push(d3.csv("data/public_health_data.csv")); //load attributes from csv    
      promises.push(d3.json("data/countiesNew.topojson")); //load counties spatial data, includes counties and CT COGS
      Promise.all(promises).then(callback);

      function callback(data) {
          var csvData = data[0], counties = data[1]; 
          
        //translate TopoJSON polygons
        var countiesUS = topojson.feature(counties, counties.objects.countiesNew2).features;
          
        //join csv data to GeoJSON enumeration units
        countiesUS = joinData(countiesUS, csvData);
            //examine the results
            console.log(countiesUS)
  
        //add states to map, if using counties albers file
        // consider if/how to use D3 mesh function for state outlines instead
        //var states = mainMap.append("path")
        //.datum(countiesUS)
        //.attr("class", "states")
        //.attr("d", path);

        //add dropdown menu for attribute selection
        createDropdown(csvData);
        
        // Call makeColorScale to create the initial color scale
        var colorScale = makeColorScale(csvData, initialFirstVariable, initialSecondVariable); 
        
        //add enumeration units to the map
        setEnumerationUnits(countiesUS, mainMap, path, colorScale, initialFirstVariable, initialSecondVariable);

        // Call updateMap with the color scale as an argument
        updateMap(csvData, initialFirstVariable, initialSecondVariable, colorScale); 
    };

    // Call createLegend to create the legend
    createLegend();
  }; //end of setMap()
  
  function joinData(countiesUS, csvData){
    //loop through csv to assign each set of csv attribute values to geojson region
    for (var i=0; i<csvData.length; i++){
        var csvCounty = csvData[i]; //the current county
        csvKey = csvCounty.id;
  
        //loop through geojson counties to find correct county id
        for (var a=0; a<countiesUS.length; a++){
  
            var geojsonProps = countiesUS[a].properties; //the current county geojson properties
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
    return countiesUS;
  }; // end of function joinData
  
  function makeColorScale(csvData, firstVariable, secondVariable) {
    // Create quintile breaks for each variable
    var numQuintiles = 5;
    var numColors = 3;
    const firstValues = [];
    const secondValues = [];
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
      ])
      .range([
        "#e8e8e8", "#ace4e4", "#5ac8c8",
        "#dfb0d6", "#a5add3", "#5698b9",
        "#be64ac", "#8c62aa", "#3b4994"
      ]);
  
    return (d) => {
      var firstQuintile = firstQuintiles(d[firstVariable]);
      var secondQuintile = secondQuintiles(d[secondVariable]);
      var mappedFirstQuintile = mapToThree(firstQuintile);
      var mappedSecondQuintile = mapToThree(secondQuintile);
      var quintilePair = [mappedFirstQuintile, mappedSecondQuintile];
      //console.log(`First quintile for ${d.CODE_LOCAL}:`, firstQuintile); // Debug statement
      //console.log(`Second quintile for ${d.CODE_LOCAL}:`, secondQuintile); // Debug statement
      //console.log(`Mapped first quintile for ${d.CODE_LOCAL}:`, mappedFirstQuintile); // Debug statement
      //console.log(`Mapped second quintile for ${d.CODE_LOCAL}:`, mappedSecondQuintile); // Debug statement
      //console.log(`Quintile pair for ${d.CODE_LOCAL}:`, quintilePair); // Debug statement
      return bivariateColorScale(quintilePair.join(","));
    };
  };
  
  function updateMap(csvData, firstVariable, secondVariable, colorScale) {
    //console.log("updateMap called with variables:", firstVariable, secondVariable); // Debug statement
    // Update colors of enumeration units
    var counties = d3.selectAll(".counties");
    console.log("Selected counties:", counties.size()); // Debug statement
    counties.transition()
      .duration(1000)
      .style("fill", function(d) {
        // Combine data values for both variables
        var combinedValue = [d.properties[firstVariable], d.properties[secondVariable]];
        //console.log(`Combined value for ${d.properties.CODE_LOCAL}:`, combinedValue); // Debug statement
        if (d.properties[firstVariable] != null && d.properties[secondVariable] != null) {
          var color = colorScale(d.properties);
          //console.log(`Updated color for ${d.properties.CODE_LOCAL}:`, color); // Debug statement
          return color;
        } else {
          //console.warn(`Missing or invalid value for ${d.properties.CODE_LOCAL}`); // Debug statement
          return "#ccc";
        }
      });
  }// end of function updateMap
  
  function createDropdown(csvData) {
    // Access existing HTML elements with D3.js
    var dropdownContainer = d3.select("#dropdown-container");
    var dropdown1 = d3.select("#dropdown-set1");
    var dropdown2 = d3.select("#dropdown-set2");
  
    // Initialize variables
    var firstVariable = "obesity";
    var secondVariable = "physical_inactivity";
  
    dropdown1.selectAll("option")
      .data([
        { value: "teeth_lost", text: "All teeth lost among adults aged >=65 years" },
        { value: "arthritis", text: "Arthritis among adults" },
        { value: "cancer", text: "Cancer (non-skin) or melanoma among adults" },
        { value: "copd", text: "Chronic obstructive pulmonary disease among adults" },
        { value: "heart_disease", text: "Coronary heart disease among adults" },
        { value: "asthma", text: "Current asthma among adults" },
        { value: "depression", text: "Depression among adults" },
        { value: "high_blood_pressure", text: "High blood pressure among adults" },
        { value: "high_cholesterol", text: "High cholesterol among adults who have ever been screened" },
        { value: "obesity", text: "Obesity among adults" },
        { value: "stroke", text: "Stroke among adults" }
      ])
      .enter()
      .append("option")
      .text(d => d.text)
      .attr("value", d => d.value)
      .attr("title", d => d.text);
  
    // Set initial selected option for dropdown 1
    dropdown1.property("value", firstVariable);
  
      dropdown2.selectAll("option")
      .data([
        { value: "binge_drinking", text: "Binge drinking among adults" },
        { value: "smoking", text: "Current cigarette smoking among adults" },
        { value: "physical_inactivity", text: "No leisure-time physical activity among adults" },
        { value: "short_sleep_duration", text: "Short sleep duration among adults" }
      ])
      .enter()
      .append("option")
      .text(d => d.text)
      .attr("value", d => d.value)
      .attr("title", d => d.text);
  
    // Set initial selected option for dropdown 2
    dropdown2.property("value", secondVariable);
  
    // Add event listeners to the dropdowns    
    function handleDropdownChange() {
      firstVariable = d3.select("#dropdown-set1").property("value");
      secondVariable = d3.select("#dropdown-set2").property("value");
      console.log(`Selected first variable: ${firstVariable}`); // Debug statement
      console.log(`Selected second variable: ${secondVariable}`); // Debug statement
      var colorScale = makeColorScale(csvData, firstVariable, secondVariable);
      console.log("Calling updateMap"); // Debug statement
      updateMap(csvData, firstVariable, secondVariable, colorScale);
      // Update event listeners for highlighting with new variables
      d3.selectAll(".counties")
        .on("mouseover", function(event, d){
            highlight(d.properties, firstVariable, secondVariable);
        })
        .on("mouseout", function(event, d){
            dehighlight(d.properties);
        });
    }

    dropdown1.on("change", handleDropdownChange);
    dropdown2.on("change", handleDropdownChange);
  }; // end of function createDropdown
  
  function setEnumerationUnits(countiesUS, mainMap, path, colorScale, firstVariable, secondVariable){
  
    //add counties to map
    var enumerationUnits = mainMap.selectAll(".counties")
        .data(countiesUS)
        .enter()
        .append("path")
        .attr("class", function(d){
            return "counties " + d.properties.CODE_LOCAL; // Ensure the class is correctly applied
        })
        .attr("d", path)
        .style("fill", function(d) {
          var combinedValue = [d.properties[firstVariable], d.properties[secondVariable]];
          if (d.properties[firstVariable] != null && d.properties[secondVariable] != null) {
            var color = colorScale(d.properties);
            //console.log(`Initial color for ${d.properties.CODE_LOCAL}:`, color); // Debug statement
            return color;
          } else {
            console.warn("Missing or invalid value for:", d.properties.CODE_LOCAL);
            return "#ccc";
          }
        })
        .on("mouseover", function(event, d){
            highlight(d.properties, firstVariable, secondVariable);
        })
        .on("mouseout", function(event, d){
            dehighlight(d.properties);
        })
        .on("mousemove", moveLabel);       
  };  // end of function setEnumerationUnits
  
    
  //function to create dynamic label
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
  
  };
  
  //function to move info label with mouse
  function moveLabel(event){
    //get width of label
    var labelWidth = d3.select(".infolabel")
        .node()
        .getBoundingClientRect()
        .width;
  
    //use coordinates of mousemove event to set label coordinates
    var x1 = event.clientX + 10,
        y1 = event.clientY - 75,
        x2 = event.clientX - labelWidth - 10,
        y2 = event.clientY + 25;
  
    //horizontal label coordinate, testing for overflow
    var x = event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1; 
    //vertical label coordinate, testing for overflow
    var y = event.clientY < 75 ? y2 : y1; 
  
    d3.select(".infolabel")
        .style("left", x + "px")
        .style("top", y + "px");
  };
      
  //function to highlight enumeration units
  function highlight(props, firstVariable, secondVariable){
    //change stroke
    var selected = d3.selectAll("." + props.NAME_ALT.replace("'", "\\'")) // debug syntax error for counties containing single quote like O'Brien
        .style("stroke", "black")
        .style("stroke-width", "2");
    setLabel(props, firstVariable, secondVariable);
  };
  
  //function to reset the element style on mouseout
  function dehighlight(props){
    var selected = d3.selectAll("." + props.NAME_ALT.replace("'", "\\'")) // debug syntax error for counties containing single quote like O'Brien
        .style("stroke", function(){
            return getStyle(this, "stroke")
        })
        .style("stroke-width", function(){
            return getStyle(this, "stroke-width")
        });
  
    function getStyle(element, styleName){
        var styleText = d3.select(element)
            .select("desc")
            .text();
  
        var styleObject = JSON.parse(styleText);
  
        return styleObject[styleName];
    };
    //remove info label
    d3.select(".infolabel")
    .remove();
  };

  // Create bivariate legend
  function createLegend() {
    var legendWidth = 120;
    var legendHeight = 120;
    var legendMargin = { top: 20, right: 10, bottom: 10, left: 10 };
  
    var svg = d3.select("#legend-container").append("svg") // Append to the new container
      .attr("class", "legend")
      .attr("width", legendWidth + legendMargin.left + legendMargin.right)
      .attr("height", legendHeight + legendMargin.top + legendMargin.bottom);
  
    var legendGroup = svg.append("g")
      .attr("transform", "translate(" + (legendWidth / 2 + legendMargin.left) + "," + (legendHeight / 2 + legendMargin.top) + ") rotate(-45)");
  
    var colorScale = d3.scaleOrdinal()
      .domain([
        "0,0", "0,1", "0,2",
        "1,0", "1,1", "1,2",
        "2,0", "2,1", "2,2"
      ])
      .range([
        "#e8e8e8", "#ace4e4", "#5ac8c8",
        "#dfb0d6", "#a5add3", "#5698b9",
        "#be64ac", "#8c62aa", "#3b4994"
      ]);
  
    var legendData = d3.cross([0, 1, 2], [0, 1, 2]);
  
    legendGroup.selectAll("rect")
      .data(legendData)
      .enter()
      .append("rect")
      .attr("x", function(d) { return (d[1] - 1) * 30; }) // Center the legend
      .attr("y", function(d) { return (1 - d[0]) * 30; }) // Center the legend and flip y-axis
      .attr("width", 30)
      .attr("height", 30)
      .style("fill", function(d) {
        return colorScale(d.join(","));
      });
  
    // Append non-rotated text labels outside the rotated group
    svg.append("text")
      .attr("x", legendWidth / 2 + legendMargin.left)
      .attr("y", legendHeight + legendMargin.top + 5)
      .style("text-anchor", "middle")
      .text("Low");

    svg.append("text")
      .attr("x", legendWidth / 2 + legendMargin.left)
      .attr("y", legendMargin.top - 5) 
      .style("text-anchor", "middle")
      .text("High");
  }   
  })();



