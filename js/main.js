// This JS files contains the main functions for a bivariate choropleth map
// that displays health outcomes and health risk behaviors for each county in the United States.
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
  var initialFirstVariable = attrArray[10]; // obesity
  var initialSecondVariable = attrArray[14]; // physical_inactivity

  //begin script when window loads
  window.onload = setMap();
  
  //set up choropleth map
  function setMap(){
  
    //map frame dimensions
    var width = 800,
    height = 600;
  
    // Create new svg container for the main U.S. map
    var mainMap = d3.select("#mainMap") 
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
      promises.push(d3.json("data/states.topojson")); // load states spatial data
      Promise.all(promises).then(callback);

      function callback(data) {
          var csvData = data[0], counties = data[1], states = data[2];
          
        //translate TopoJSON polygons
        var countiesUS = topojson.feature(counties, counties.objects.countiesNew2).features;
        var statesUS = topojson.feature(states, states.objects.states)
          
        //join csv data to GeoJSON enumeration units
        countiesUS = joinData(countiesUS, csvData);
            //examine the results
            console.log(countiesUS)

        //add state boundaries to map
        var statesUS = mainMap.append("path")
          .datum(statesUS)
          .attr("class", "states")
          .attr("d", path);

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
    //loop through csv to assign each set of csv attribute values to geojson county
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
  
  function updateMap(csvData, firstVariable, secondVariable, colorScale) {
    //console.log("updateMap called with variables:", firstVariable, secondVariable); // Use for debugging
    // Update colors of enumeration units
    var counties = d3.selectAll("#mainMap .counties");
    counties.transition()
      .duration(300)
      .style("fill", function(d) {
        // Combine data values for both variables and check for null values
        var combinedValue = [d.properties[firstVariable], d.properties[secondVariable]];
        //console.log(`Combined value for ${d.properties.CODE_LOCAL}:`, combinedValue); // Use for debugging
        if (d.properties[firstVariable] != null && d.properties[secondVariable] != null) {
          var color = colorScale(d.properties);
          //console.log(`Updated color for ${d.properties.CODE_LOCAL}:`, color); // Use for debugging
          return color;
        } else {
          //console.warn(`Missing or invalid value for ${d.properties.CODE_LOCAL}`); // Use for debugging
          return "#ccc";
        }
      });
  }// end of function updateMap
  
  // Create dropdown menus for selecting variables
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
        { value: "diabetes", text: "Diagnosed diabetes among adults" },
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
      //console.log(`Selected first variable: ${firstVariable}`); // Use for debugging
      //console.log(`Selected second variable: ${secondVariable}`); // Use for debugging
      var colorScale = makeColorScale(csvData, firstVariable, secondVariable);
      // console.log("Calling updateMap"); // Use for debugging
      updateMap(csvData, firstVariable, secondVariable, colorScale);
      // Update event listeners for highlighting with new variables
      d3.selectAll("#mainMap .counties") // Ensure only mainMap counties are selected
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
  
  // Create enumeration units
  function setEnumerationUnits(countiesUS, mainMap, path, colorScale, firstVariable, secondVariable){
    //add counties to map
    var enumerationUnits = mainMap.selectAll(".counties")
        .data(countiesUS)
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

  // Create bivariate legend
  function createLegend() {
    var legendWidth = 140;
    var legendHeight = 130;
    var legendMargin = { top: 20, right: 40, bottom: 40, left: 60 };
  
    var svg = d3.select("#legend-container").append("svg") // Append to the new container
      .attr("class", "legend")
      .attr("width", legendWidth + legendMargin.left + legendMargin.right)
      .attr("height", legendHeight + legendMargin.top + legendMargin.bottom);
  
    // rotate the legend group to make a diamond shape 
    var legendGroup = svg.append("g")
      .attr("transform", "translate(" + (legendWidth / 2 + legendMargin.left) + "," + (legendHeight / 2 + legendMargin.top) + ") rotate(-45)");
  
    // set the color scale for the legend  
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
      .call(wrapText, "Low Health Outcome - Low Risk Behavior");

    svg.append("text")
      .attr("x", legendWidth / 2 + legendMargin.left)
      .attr("y", legendMargin.top - 5) 
      .style("text-anchor", "middle")
      .call(wrapText, "High Health Outcome - High Risk Behavior");

    svg.append("text")
      .attr("x", legendMargin.left - 10)
      .attr("y", legendHeight / 2 + legendMargin.top)
      .style("text-anchor", "middle")
      .call(wrapText, "High Health Outcome - Low Risk Behavior");

    svg.append("text")
      .attr("x", legendWidth + legendMargin.right + 10)
      .attr("y", legendHeight / 2 + legendMargin.top)
      .style("text-anchor", "middle")
      .call(wrapText, "High Risk Behavior - Low Health Outcome");
  } // end of create legend function

  // Wrap the text on the legend labels to prevent overflow
  function wrapText(text, content) {
      var words = content.split(" ");
      var line = [];
      var lineNumber = 0;
      var lineHeight = 1.1; // ems
      var y = text.attr("y");
      var x = text.attr("x");
      var dy = 0;
      var tspan = text.text(null).append("tspan").attr("x", x).attr("y", y).attr("dy", dy + "em");
      words.forEach(function(word) {
          line.push(word);
          tspan.text(line.join(" "));
          if (tspan.node().getComputedTextLength() > 100) {
              line.pop();
              tspan.text(line.join(" "));
              line = [word];
              tspan = text.append("tspan").attr("x", x).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
          }
      });
  } //end of wrap text function
  
  })();



