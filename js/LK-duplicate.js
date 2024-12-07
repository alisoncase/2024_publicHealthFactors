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
    var expressed = attrArray[0]; //initial attribute
    
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
        .attr("width", width)
        .attr("height", height);
    
      // Set main map projection to U.S. Albers to position HI and AK below CONUS
      var projection = d3.geoAlbersUsa()
        .scale(1000)
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
        promises.push(d3.json("data/counties.topojson")); //load counties spatial data
        Promise.all(promises).then(function(data) {
          //var csvData = data[0];
          //var counties = data[1];
          //  console.log(csvData);
          //  console.log(counties);
            callback(mainMap, path, data); 
        });
    
      // Set up callback function
      function callback(mainMap, path, data) {
          var csvData = data[0],
              counties = data[1];
          console.log(csvData);
          console.log(counties);
    
          //translate TopoJSON polygons
          var countiesUS = topojson.feature(counties, counties.objects.collection).features;
          //examine the results
            console.log(countiesUS)
                  
          //join csv data to GeoJSON enumeration units
          countiesUS = joinData(countiesUS, csvData);
            console.log(countiesUS)
    
          //add states to map, if using counties albers file
          // consider if/how to use D3 mesh function for state outlines instead
          //var states = mainMap.append("path")
          //.datum(countiesUS)
          //.attr("class", "states")
          //.attr("d", path);
          
          //add enumeration units to the map
          setEnumerationUnits(countiesUS, mainMap, path, colorScale);
      
          //add dropdown menu for attribute selection
          createDropdown(csvData);
    
          var firstVariable = d3.select("#dropdown-set1").property("value");
          var secondVariable = d3.select("#dropdown-set2").property("value");
    
          //create the color scale
          var colorScale = makeColorScale(csvData, firstVariable, secondVariable);
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
      return countiesUS
    };
    
    function makeColorScale(csvData, firstVariable, secondVariable) {
    
      // Create quantile breaks for each variable
      var numQuantiles = 5;
      const firstValues = [];
      const secondValues = [];
    
      for (let i = 0; i < csvData.length; i++) {
        const dataPoint = csvData[i];
        firstValues.push(dataPoint[firstVariable]);
        secondValues.push(dataPoint[secondVariable]);
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
    
      // Create a color range using an ordinal scale
      var colorRange = d3.scaleOrdinal()
        .domain(d3.range(numQuantiles * numQuantiles))
        .range([
          "#f2f0f7", // lightest color
          "#cbc9e2",
          "#9e9ac8",
          "#756bb1",
          "#54278f", // darkest color
          "#deebf7", // another light color
          "#c6dbef",
          "#99b4e2",
          "#6c7aac", // mid color range
          "#43497e",
          "#d0e0e3", // ... and so on
          "#b2becc",
          "#8ca6b6",
          "#63799a",
          "#3b5378"
        ]);
    
      // Define a function to assign colors based on quantile indices
      var getColor = (d) => {
        var firstIndex = d[0];
        var secondIndex = d[1];
        var combinedIndex = firstIndex * numQuantiles + secondIndex;
        return colorRange(combinedIndex);
      };
    
      // Return a function that assigns colors based on the bivariate data
      return (d) => getColor(bivariateValues[data.indexOf(d)]);
    }
    
    function updateMap() {
      var firstVariable = d3.select("#dropdown-set1").property("value");
      var secondVariable = d3.select("#dropdown-set2").property("value");
      
      var colorScale = makeColorScale(csvData, firstVariable, secondVariable);
    
      // Update colors of enumeration units
      d3.selectAll(".counties")
        .transition()
        .duration(1000)
        .style("fill", function(d) {
          // Combine data values for both variables
          var combinedValue = [d.properties[firstVariable], d.properties[secondVariable]];
          
          // Use the color scale to get the fill color
          var fillColor = makeColorScale(combinedValue);
          
          return fillColor || "#ccc"; // Default color for missing data
        });
    };
    
    function createDropdown(csvData) {
      var dropdownContainer = d3.select("#dropdown-container");
    
      // Create the first dropdown
      var dropdown1 = dropdownContainer.append("select")
        .attr("id", "dropdown-set1");
    
      dropdown1.selectAll("option")
        .data([
          "teeth_lost", "arthritis", "cancer", "copd", "heart_disease",
          "asthma", "depression", "diabetes", "high_blood_pressure",
          "high_cholesterol", "obesity", "stroke"
        ])
        .enter()
        .append("option")
        .text(d => d)
        .attr("value", d => d);
    
      // Set initial selected option for dropdown 1 
      d3.select("#dropdown-set1").property("value", "diabetes"); 
    
      // Create the second dropdown
      var dropdown2 = dropdownContainer.append("select")
        .attr("id", "dropdown-set2");
    
      dropdown2.selectAll("option")
        .data(["binge_drinking", "smoking", "physical_inactivity", "short_sleep_duration"])
        .enter()
        .append("option")
        .text(d => d)
        .attr("value", d => d);
    
      // Set initial selected option for dropdown 2 
      d3.select("#dropdown-set2").property("value", "physical_inactivity"); 
    
      // Add event listeners to the dropdowns
      dropdown1.on("change", () => {
        updateMap();
      });
    
      dropdown2.on("change", () => {
        updateMap();
      });
    };
    
    function setEnumerationUnits(countiesUS, mainMap, path, colorScale){
    
      //add counties to map
      var enumerationUnits = mainMap.selectAll(".counties")
          .data(countiesUS)
          .enter()
          .append("path")
          .attr("class", function(d){
              return "counties" + d.properties.CODE_LOCAL;})
          .attr("d", path)
          // TO DO: Re-write this .style section
          //.style("fill", function(d){
          //    var value = d.properties[expressed];
          //    if(value) {
          //        return makeColorScale(d.properties[expressed]);
          //    } else {
          //        console.warn("Missing or invalid value for:", d.properties.CODE_LOCAL)
          //        return "#ccc";
          //    }               
          //})
          //.on("mouseover", function(event, d){
          //    highlight(d.properties);
          //})
          //.on("mouseout", function(event, d){
          //    dehighlight(d.properties);
          //})
          //.on("mousemove", moveLabel);
      //var desc = enumerationUnits.append("desc")
        //  .text('{"stroke": "#969696", "stroke-width": "1.5px"}');
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
    
    //function to create dynamic label
    function setLabel(props){
      //label content
      var labelAttribute = "<h1>" + props[expressed].toFixed(2) + 
      "%</h1><b>" + expressed + "</b>";
    
      //create info label div
      var infolabel = d3.select("body")
          .append("div")
          .attr("class", "infolabel")
          .attr("id", props.name_alt + "_label")
          .html(labelAttribute);
    
      var countyName = infolabel.append("div")
          .attr("class", "labelname")
          .html(props.name_alt);
    };
    
    //function to move info label with mouse
    function moveLabel(event){
      //get width of label
      var labelWidth = d3.select(".infolabel")
          .node()
          .getBoundingClientRect()
          .width;
    
      //use coordinates of mousemove event to set label coordinates
      var x1 = event.clientX + 2,
          y1 = event.clientY - 2,
          x2 = event.clientX - labelWidth - 2,
          y2 = event.clientY + 2;
    
      //horizontal label coordinate, testing for overflow
      var x = event.clientX > window.innerWidth - labelWidth - 2 ? x2 : x1; 
      //vertical label coordinate, testing for overflow
      var y = event.clientY < 2 ? y2 : y1; 
    
      d3.select(".infolabel")
          .style("left", x + "px")
          .style("top", y + "px");
    };
    
    
    
    //function to highlight enumeration units
    function highlight(props){
      //change stroke
      var selected = d3.selectAll("." + props.NAME_ALT)
          .style("stroke", "black")
          .style("stroke-width", "2");
      setLabel(props);
    };
    
    //function to reset the element style on mouseout
    function dehighlight(props){
      var selected = d3.selectAll("." + props.NAME_ALT)
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
    
    
    // Set up function for bivariate legend, adapted from https://observablehq.com/
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
    
    