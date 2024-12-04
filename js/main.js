
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
  var mainMap = d3.select("#mainMap")
    .append("svg")
    .attr("class", "mainMap")
    .attr("width", width)
    .attr("height", height);

  // Set main map projection to U.S. Albers to position HI and AK below CONUS
  var projection = d3.geoAlbersUsa()
    //.scale(1000)
    //.translate([width / 2, height / 2]);
    //use below for counties albers file
    .scale(1300)
    .translate([487.5, 305]);

  // Set spatial data path
  var path = d3.geoPath()
    .projection(projection);

  //use Promise.all to parallelize asynchronous data loading
  var promises = [];    
    promises.push(d3.csv("data/public_health_data.csv")); //load attributes from csv    
    promises.push(d3.json('https://cdn.jsdelivr.net/npm/us-atlas@3/counties-albers-10m.json')); //load counties spatial data
    Promise.all(promises).then(function(data) {
      var csvData = data[0];
      var counties = data[1];
        console.log(csvData);
        console.log(counties);
        callback(mainMap, path, csvData, counties); 
    });

  // Set up callback function
  function callback(mainMap, path, csvData, counties) {
      //var csvData = data[0],
      //    counties = data[1];
      //console.log(csvData);
      //console.log(counties);

      //place graticule on the map
      //setGraticule(map, path);

      //translate TopoJSON polygons
      var countiesUS = topojson.feature(counties, counties.objects.counties);
      //examine the results
      console.log(countiesUS)
              
      //join csv data to GeoJSON enumeration units
      countiesUS = joinData(countiesUS, csvData);

      //create the color scale
      var colorScale = scheme(csvData);

      //add enumeration units to the map
      setEnumerationUnits(countiesUS, mainMap, path, colorScale);
  
      //add dropdown menu for attribute selection
      //createDropdown(csvData);
  };
}; //end of setMap()

// Set up function for bivariate legend, adapted from https://observablehq.com/
function chart(Plot,scheme,d3,label,data,topojson,us,bivariateClass,states,svg)
{
  const legend = Plot.plot({
    color: {
      range: scheme,
      transform: ([a, b]) => 3 * a + b,
      unknown: "#ccc" //
    },
    axis: null,
    margin: 0,
    inset: 18,
    width: 106,
    height: 106,
    style: "overflow: visible;",
    marks: [
      Plot.dot(d3.cross([0, 1, 2], [0, 1, 2]), {
        x: ([a, b]) => b - a,
        y: ([a, b]) => b + a,
        symbol: "square",
        rotate: 45,
        r: 14,
        fill: (d) => d,
        title: ([a, b]) => `Diabetes${label(a)}\nObesity${label(b)}`,
        tip: true
      }),
      Plot.text(["Obesity →"], {
        frameAnchor: "right",
        fontWeight: "bold",
        rotate: -45,
        dy: 10
      }),
      Plot.text(["← Diabetes"], {
        frameAnchor: "left",
        fontWeight: "bold",
        rotate: 45,
        dy: 10
      })
    ]
  });

  const color = legend.scale("color");
  const index = new Map(data.mainMap(({ county, ...rest }) => [county, rest]));
  return Plot.plot({
    width: 975,
    height: 610,
    projection: "identity",
    color,
    marks: [
      Plot.geo(
        topojson.feature(us, us.objects.counties),
        Plot.centroid({
          stroke: "white",
          strokeWidth: 0.125,
          fill: (d) => bivariateClass(index.get(d.id)),
          title: (d) => {
            const name = `${d.properties.name}, ${states.get(d.id.slice(0, 2)).name}`;
            const value = index.get(d.id);
            if (!value || (isNaN(value.diabetes) && isNaN(value.obesity)))
              return `${name}\nno data`;
            const [dc, oc] = bivariateClass(value);
            return `${name}\n${
              isNaN(value.diabetes) ? "No Data" : value.diabetes
            }% Diabetes${label(dc)}\n${
              isNaN(value.obesity) ? "No Data" : value.obesity
            }% Obesity${label(oc)}`;
          },
          tip: true
        })
      ),
      Plot.geo(topojson.mesh(us, us.objects.states, (a, b) => a !== b), {stroke: "white"}),
      () => svg`<g transform="translate(835,410)">${legend}`
    ],
    style: "overflow: visible;"
  });
};

// Set up labels
function labels(){return(
  ["low", "", "high"]
  )};
  
function label(labels){return(
  i => labels[i] ? ` (${labels[i]})` : ""
  )};

// Set up variables for bivariate choropleth
function dataVariables(dataset){return(dataset
  .then((data) => {
    data.forEach((d) => {
      d.obesity = +d.obesity; 
      d.diabetes = +d.diabetes;
    });
    return data;
  })
)};

// Function to calculate low to high thresholds for diabetes variable
function diabetes_thresholds(d3,data){return(
d3.scaleQuantile(data.mainMap(d => d.diabetes), [0, 1, 2]).quantiles()
)};

// Function to calculate low to high thresholds for obesity variable
function obesity_thresholds(d3,data){return(
d3.scaleQuantile(data.mainMap(d => d.obesity), [0, 1, 2]).quantiles()
)};

// Function to read the {diabetes, obesity} value of a county and 
// return its class from low to high based on its value within the thresholds
function bivariateClass(diabetes_thresholds,obesity_thresholds)
{
  const d = diabetes_thresholds;
  const o = obesity_thresholds;
  return (value) => {
    const { diabetes: a, obesity: b } = value;
    return [
      isNaN(a) ? a : +(a > d[0]) + (a > d[1]),
      isNaN(b) ? b : +(b > o[0]) + (b > o[1])
    ];
  };
};

// Function to create color scheme
function scheme(){return(
["#e8e8e8","#ace4e4","#5ac8c8","#dfb0d6","#a5add3","#5698b9","#be64ac","#8c62aa","#3b4994"]
)};


function us(topology){return(
topology).json()
};

function states(us){return(
new Map(us.objects.states.geometries.mainMap(d => [d.id, d.properties]))
)};

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

function setEnumerationUnits(countiesUS, mainMap, path, colorScale){

  //add Chicago neighborhoods to map
  var communities = mainMap.selectAll(".counties")
      .data(countiesUS)
      .enter()
      .append("path")
      .attr("class", function(d){
          return "counties" + d.properties.id;})
      .attr("d", path)
      .style("fill", function(d){
          var value = d.properties[expressed];
          if(value) {
              return colorScale(d.properties[expressed]);
          } else {
              console.warn("Missing or invalid value for:", d.properties.id)
              return "#ccc";
          }               
      })
      .on("mouseover", function(event, d){
          highlight(d.properties);
      })
      .on("mouseout", function(event, d){
          dehighlight(d.properties);
      })
      .on("mousemove", moveLabel);
  var desc = communities.append("desc")
      .text('{"stroke": "#969696", "stroke-width": "1.5px"}');
};

//function to highlight enumeration units
function highlight(props){
  //change stroke
  var selected = d3.selectAll("." + props.name)
      .style("stroke", "black")
      .style("stroke-width", "2");
  setLabel(props);
};

//function to reset the element style on mouseout
function dehighlight(props){
  var selected = d3.selectAll("." + props.name)
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

function joinData(countiesUS, csvData){
  //loop through csv to assign each set of csv attribute values to geojson region
  for (var i=0; i<csvData.length; i++){
      var csvCounty = csvData[i]; //the current county
      var csvKey = csvCounty.id; //the CSV primary key 

      //loop through geojson regions to find correct region
      for (var a=0; a<countiesUS.length; a++){

          var geojsonProps = countiesUS[a].properties; //the current county geojson properties
          var geojsonKey = geojsonProps.id; //the geojson primary key

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

// Update map on dropdown change
  d3.select("#dropdown-set1").on("change", function() {
    const selectedVar1 = this.value;
    updateMap(selectedVar1, d3.select("#dropdown-set2").property("value"));
});

d3.select("#dropdown-set2").on("change", function() {
    const selectedVar2 = this.value;
    updateMap(d3.select("#dropdown-set1").property("value"), selectedVar2);
});

//function setGraticule(map, path){
  //create graticule generator
 // var graticule = d3.geoGraticule()
 // .step([5, 5]); //place graticule lines every 5 degrees of longitude and latitude

  //create graticule background
 // var gratBackground = map.append("path")
 //     .datum(graticule.outline()) //bind graticule background
 //     .attr("class", "gratBackground") //assign class for styling
 //     .attr("d", path) //project graticule

  //create graticule lines
  //var gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
  //    .data(graticule.lines()) //bind graticule lines to each element to be created
  //    .enter() //create an element for each datum
  //    .append("path") //append each element to the svg as a path element
  //    .attr("class", "gratLines") //assign class for styling
  //    .attr("d", path); //project graticule lines
//};

//

//function map(mapdata) {
 //   const width=975,
 //     height=610;
  
    // Create an svg element to the map
    //const svg = d3.select("#map").append("svg")
   //     .attr("width", width)
   //     .attr("height", height)
   //     .attr("viewBox", [0, 0, 975, 610])
   //     .attr("style", "width: 100%; height: auto; height: intrinsic;");
  
    //    const data = d3.csv("data/public_health_data.csv")
    //    .then((data) => {
    //        data.forEach(row => {
    //            row.id = row.id.padStart(5, '0');
            //data.forEach((d) => {
    //        d.obesity = +d.obesity; // type as numeric
    //        d.diabetes = +d.diabetes;
    //      });
          // Create an index for data lookup
    //      const index = d3.index(data, d => d.id);
    //      return data;
    //    })
    //    .then(data => {
        // Define color scales
        //const n = 3;
        //const x = d3.scaleQuantile(Array.from(data, d => d.diabetes), d3.range(n));
        //const y = d3.scaleQuantile(Array.from(data, d => d.obesity), d3.range(n));
      
        // Define color palette
        //const colors = [
        //  "#e8e8e8", "#e4acac", "#c85a5a",
        //  "#b0d5df", "#ad9ea5", "#985356",
        //  "#64acbe", "#627f8c", "#574249"
        //];
        
        // Define labels for bins
        //const labels = {
       //   0: "Low",
        //  1: "",
        //  2: "High",
        //};
      
        // Define color function
        //const color = (d) => {
        //  const value = index.get(d.id).diabetes + x(index.get(d.id).obesity) * n;
        //  return colors[Math.floor(value)];
        //};
        //const color = (value) => {
        //  if (!value) return "#ccc";
        //  const {diabetes: a, obesity: b} = value;
        //  return colors[y(b) + x(a) * n];
        //};
    
        //const path = d3.geoPath();
        // Create the US boundary
        //const usa = svg
        //  .append('g')
        //  .append('path')
        //  .datum(topojson.feature(mapdata, mapdata.objects.nation))
        //  .attr('d', d3.geoPath());
      
        // Create the county boundaries 
        //const counties = svg
        //  .append('g')
        //  .data(topojson.feature(mapdata, mapdata.objects.counties).features)
        //  .join('path')
        //    .attr('stroke', '#444')
            //.attr("fill", color) // Use the defined color function
        //    .attr("fill", d => color(index.get(d.id)))
        //  .selectAll('path')
                  
         // .attr('vector-effect', 'non-scaling-stroke')
         // .attr('d', d3.geoPath());
      //});
    
    //window.addEventListener('DOMContentLoaded', async (event) => {
    //  const res = await fetch(`https://cdn.jsdelivr.net/npm/us-atlas@3/counties-albers-10m.json`)   
    //  const mapJson = await res.json()
    //  map(mapJson)
    //})};