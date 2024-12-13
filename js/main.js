//Wrap everything in a self-executing anonymous function to move to local scope
(function(){

  //Global variables
  //var dataset = d3.csv("data/public_health_data.csv")
  //var topology = d3.json("data/counties_albers_10m.topojson")
  //var topology = d3.json('https://cdn.jsdelivr.net/npm/us-atlas@3/counties-albers-10m.json')
  //var topology = d3.json("data/counties.topojson") 
  
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
    var mainMap = d3.select("body") //originally said "body" changed to "mainMap"
      .append("svg")
      .attr("class", "mainMap")
      .attr("d", path) // This was commented out, but now added back in to define the path of the map container
      .attr("width", width)
      .attr("height", height);
  
    // Set main map projection to U.S. Albers to position HI and AK below CONUS
    var projection = d3.geoAlbersUsa()
      .scale(1100)
      .translate([width / 2, height / 2]);
      //use the following for counties albers file
      //.scale(1300)
      //.translate([487.5, 305]);
  
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
        var colorScale = makeColorScale(csvData); //this was commented out for some reason, not sure if it needs to be
        
        //add enumeration units to the map
        setEnumerationUnits(countiesUS, mainMap, path, colorScale, initialFirstVariable, initialSecondVariable);

        // Call updateMap with the color scale as an argument
       // updateMap(csvData, initialFirstVariable, initialSecondVariable, colorScale);
    };
  }; //end of setMap()
  
  function joinData(countiesUS, csvData){
    //loop through csv to assign each set of csv attribute values to geojson region
    for (var i=0; i<csvData.length; i++){
        var csvCounty = csvData[i]; //the current county
        //var csvKey = csvCounty.id; //the CSV primary key 
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
  
  function makeColorScale(csvData) {
  
    // Create quantile breaks for each variable
    var numQuantiles = 3;
    const firstValues = [];
    const secondValues = [];
      for (let i = 0; i < csvData.length; i++) {
        var dataPoint = csvData[i];
        firstValues.push(dataPoint[initialFirstVariable]);
        secondValues.push(dataPoint[initialSecondVariable]);
   }
   var firstQuantiles = d3.scaleQuantile()
     .domain(firstValues)
      .range(d3.range(numQuantiles));
  
    var secondQuantiles = d3.scaleQuantile()
      .domain(secondValues)
      .range(d3.range(numQuantiles));
  
    // Combine quantile values into a single bivariate array
    const bivariateValues = [];
    for (let i = 0; i < firstValues.length; i++) {
      bivariateValues.push([
        firstQuantiles(firstValues[i]),
        secondQuantiles(secondValues[i])
      ]);
    }
  
    // Modify the global colorScale variable
    var colorScale= d3.scaleOrdinal()
    .domain(d3.range(numQuantiles * numQuantiles))
      .range([
        "#e8e8e8","#ace4e4","#5ac8c8",
        "#dfb0d6","#a5add3","#5698b9",
        "#be64ac","#8c62aa","#3b4994"]
      );
      console.log("First quantile breaks:", firstQuantiles.domain());
      console.log("Second quantile breaks:", secondQuantiles.domain());
      console.log("Color scale domain:", colorScale.domain());
      console.log("Color scale range:", colorScale.range());
    return colorScale;
    //This block is potentially redundant. Commenting it out for debugging purposes.
    // Define a function to assign colors based on quantile indices
    //var getColor = (d) => {
    //  var firstIndex = d[0];
    //  var secondIndex = d[1];
    //  var combinedIndex = firstIndex * numQuantiles + secondIndex;
    //  return colorScale(combinedIndex);
    //};
    // Return the getColor function
    //return getColor;
  }; // end of function makeColorScale
  
  function updateMap(csvData, firstVariable, secondVariable, colorScale) {

    var colorScale = makeColorScale(csvData);
    // Update colors of enumeration units
    d3.selectAll(".counties")
      .transition()
      .duration(1000)
      .style("fill", function(d) {
        // Combine data values for both variables
        var combinedValue = [d.properties[firstVariable], d.properties[secondVariable]];
          if(combinedValue) {
            return colorScale(combinedValue);
          }  else {
              return "#ccc";
          }
         

        //return colorScale(combinedValue); 
        //var color = colorScale(combinedValue);
        //d3.select(this).style("fill", color);  // Update style directly       
        // Use the color scale to get the fill color
        //var fillColor = makeColorScale(combinedValue);        
        //return fillColor || "#ccc"; // Default color for missing data
      });
  };// end of function updateMap
  
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
  
    // Add event listeners to the dropdowns - edited this to do the function in one move instead of 2
    
    function handleDropdownChange() {
      firstVariable = d3.select("dropdown-set1").property("value");
      secondVariable = d3.select("dropdown-set2").property("value");
      updateMap(csvData, firstVariable, secondVariable);
    }

    dropdown1.on("change", handleDropdownChange);
    dropdown2.on("change", handleDropdownChange);
    
    
    /*
    dropdown1.on("change", () => {
      firstVariable = d3.select("#dropdown-set1").property("value");
      updateMap(csvData, firstVariable, secondVariable);
    });
  
    dropdown2.on("change", () => {
      secondVariable = d3.select("#dropdown-set2").property("value");
      updateMap(csvData, firstVariable, secondVariable);
    });*/
  }; // end of function createDropdown
  
  function setEnumerationUnits(countiesUS, mainMap, path, colorScale, firstVariable, secondVariable){
  
    //add counties to map
    var enumerationUnits = mainMap.selectAll(".counties")
        .data(countiesUS)
        .enter()
        .append("path")
        .attr("class", function(d){
            return "counties" + d.properties.CODE_LOCAL;})
        .attr("d", path)
        .style("fill", function(d) {
          var combinedValue = [d.properties[firstVariable], d.properties[secondVariable]];
          if(combinedValue) {
              //return makeColorScale([d.properties[firstVariable], d.properties[secondVariable]]);
              return colorScale(combinedValue);
              //var color = colorScale(combinedValue);
              //console.log("County:", d.properties.NAME_ALT, "Combined Value:", combinedValue, "Color:", color);
              //d3.select(this).style("fill", color);  // Update style directly
              //return color
            } else {
              console.warn("Missing or invalid value for:", d.properties.CODE_LOCAL)
              //return "#ccc";
              d3.select(this).style("fill", "#ccc");
            }
        })
        .on("mouseover", function(event, d){
            highlight(d.properties, firstVariable, secondVariable);
        })
        .on("mouseout", function(event, d){
            dehighlight(d.properties);
        })
        .on("mousemove", moveLabel);        
    // Commenting this out. It's residual code from Lab 2 that isn't necessary here since we only have one visualization.
    // add style descriptor to each path
    //var desc = enumerationUnits.append("desc")
    //    .text('{"stroke": "#969696", "stroke-width": "1.5px"}');
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
    //var selected = d3.selectAll("." + props.NAME_ALT)
    var selected = d3.selectAll("." + props.NAME_ALT.replace("'", "\\'")) // debug syntax error for counties containing single quote like O'Brien
        .style("stroke", "black")
        .style("stroke-width", "2");
    setLabel(props, firstVariable, secondVariable);
  };
  
  //function to reset the element style on mouseout
  function dehighlight(props){
    //var selected = d3.selectAll("." + props.NAME_ALT)
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

    //This block is from D3 bivariate example, and has been incporated into makeColorScale
  // Function to calculate low to high thresholds for diabetes variable
  //function diabetes_thresholds(d3,data){return(
  //  d3.scaleQuantile(data.mainMap(d => d.diabetes), [0, 1, 2]).quantiles()
  //  )};
    
    // Function to calculate low to high thresholds for obesity variable
  //  function obesity_thresholds(d3,data){return(
  //  d3.scaleQuantile(data.mainMap(d => d.obesity), [0, 1, 2]).quantiles()
  //  )};
    
    // Function to read the {diabetes, obesity} value of a county and 
    // return its class from low to high based on its value within the thresholds
  //  function bivariateClass(diabetes_thresholds,obesity_thresholds)
  //  {
  //    const d = diabetes_thresholds;
  //    const o = obesity_thresholds;
  //    return (value) => {
  //      const { diabetes: a, obesity: b } = value;
  //      return [
  //        isNaN(a) ? a : +(a > d[0]) + (a > d[1]),
  //        isNaN(b) ? b : +(b > o[0]) + (b > o[1])
  //      ];
  //    };
  //  };
    
    // Function to create color scheme
  //  function scheme(){return(
  //  ["#e8e8e8","#ace4e4","#5ac8c8",
  //    "#dfb0d6","#a5add3","#5698b9",
  //    "#be64ac","#8c62aa","#3b4994"]
  //  )};
    
  // Set up function for bivariate legend, from https://observablehq.com/
  //function chart(Plot,scheme,d3,label,data,topojson,us,bivariateClass,states,svg)
  //{
  //  const legend = Plot.plot({
  //    color: {
  //      range: scheme,
  //      transform: ([a, b]) => 3 * a + b,
  //      unknown: "#ccc" //
  //    },
  //    axis: null,
  //    margin: 0,
  //    inset: 18,
  //    width: 106,
  //    height: 106,
  //    style: "overflow: visible;",
  //    marks: [
  //      Plot.dot(d3.cross([0, 1, 2], [0, 1, 2]), {
  //        x: ([a, b]) => b - a,
  //        y: ([a, b]) => b + a,
  //        symbol: "square",
  //        rotate: 45,
  //       r: 14,
  //        fill: (d) => d,
  //        title: ([a, b]) => `Diabetes${label(a)}\nObesity${label(b)}`,
  //        tip: true
  //      }),
  //      Plot.text(["Obesity →"], {
  //        frameAnchor: "right",
  //        fontWeight: "bold",
  //        rotate: -45,
  //        dy: 10
  //      }),
  //      Plot.text(["← Diabetes"], {
  //        frameAnchor: "left",
  //        fontWeight: "bold",
  //        rotate: 45,
  //        dy: 10
  //      })
  //    ]
  //  });
  
  //  const color = legend.scale("color");
  //  const index = new Map(data.mainMap(({ county, ...rest }) => [county, rest]));
  //  return Plot.plot({
  //    width: 975,
  //    height: 610,
  //    projection: "identity",
  //    color,
  //    marks: [
  //      Plot.geo(
  //        topojson.feature(us, us.objects.counties),
  //        Plot.centroid({
  //          stroke: "white",
  //          strokeWidth: 0.125,
  //          fill: (d) => bivariateClass(index.get(d.id)),
  //          title: (d) => {
  //            const name = `${d.properties.name}, ${states.get(d.id.slice(0, 2)).name}`;
  //            const value = index.get(d.id);
  //            if (!value || (isNaN(value.diabetes) && isNaN(value.obesity)))
  //              return `${name}\nno data`;
  //            const [dc, oc] = bivariateClass(value);
  //            return `${name}\n${
  //              isNaN(value.diabetes) ? "No Data" : value.diabetes
  //            }% Diabetes${label(dc)}\n${
  //              isNaN(value.obesity) ? "No Data" : value.obesity
  //            }% Obesity${label(oc)}`;
  //          },
  //          tip: true
  //        })
  //      ),
  //      Plot.geo(topojson.mesh(us, us.objects.states, (a, b) => a !== b), {stroke: "white"}),
  //      () => svg`<g transform="translate(835,410)">${legend}`
  //    ],
  //    style: "overflow: visible;"
  //  });
  //};
  
  // Set up labels
  //function labels(){return(
  //  ["low", "", "high"]
  //  )};
    
  //function label(labels){return(
  //  i => labels[i] ? ` (${labels[i]})` : ""
  //  )};
  
  // Set up variables for bivariate choropleth
  //function dataVariables(dataset){return(dataset
  //  .then((data) => {
  //    data.forEach((d) => {
  //      d.obesity = +d.obesity; 
  //      d.diabetes = +d.diabetes;
  //    });
  //    return data;
  //  })
  //)};
  
  
  })();
  
  