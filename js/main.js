
//Initial draft outline/script for interactive map. Needs more refinement, troubleshooting, etc.
const width = 960;
const height = 500;
const dataSource = "data/public_health_data.csv";

const n = 3; // Number of squares in each direction
const schemes = [
    {
      name: "BuPu", 
      colors: [
        "#e8e8e8", "#ace4e4", "#5ac8c8",
        "#dfb0d6", "#a5add3", "#5698b9", 
        "#be64ac", "#8c62aa", "#3b4994"
      ]
    },
  ];
const labels = [
    ["Low", "", "High"], // Labels for variable 1
    ["Low", "", "High"]  // Labels for variable 2
];

// Load data
d3.csv(dataSource, (data) => {
    const topojson = d3.json("data/maps.topojson", (error, mapData) => {
        if (error) throw error;

        const projection = d3.geoAlbersUsa()
            .fitExtent([[0, 0], [width, height]], mapData);

        const path = d3.geoPath().projection(projection);

                // Function to update map based on selections
                function updateMap(selectedVar1, selectedVar2) {
                    svg.selectAll("path.county")
                    .transition()
                    .duration(750)
                    .attr("fill", (d) => {
                      const value1 = d.properties[selectedVar1];
                      const value2 = d.properties[selectedVar2];
                
                      // Normalize values to a 0-8 range
                      const normalizedValue1 = Math.floor(value1 / 12.5);
                      const normalizedValue2 = Math.floor(value2 / 12.5);
                
                      // Calculate the index into the color scheme
                      const colorIndex = normalizedValue2 * n + normalizedValue1;
        
                      const legendColor = schemes[0].colors[colorIndex]; // Use the selected color

                      //another option for scale
                      const scale1 = d3.scaleLinear()
                      .domain([0, d3.max(data, d => d[selectedVar1])])
                      .range(schemes[0].colors);
                  
                      const scale2 = d3.scaleLinear()
                      .domain([0, d3.max(data, d => d[selectedVar2])])
                      .range(schemes[0].colors);
        
              
                    // Update legend squares based on selected variables and color scheme
                    legendDiamond.selectAll("rect")
                    .attr("fill", (d) => {
                        const i = d[0];
                        const j = d[1];
                        const colorIndex = j * n + i;
                        return shemes[0].colors[colorIndex];
                    });
                            
                    // Update legend text based on selected variables (modify format function as needed)
                    const format = (value) => {
                        if (!value) return "N/A";
                        const { [selectedVar1]: a, [selectedVar2]: b } = value;
                        return `${a}% ${selectedVar1}${b}% ${selectedVar2}`; // Update format based on selected variables
                    };
        
                    svg.selectAll(".tooltip-text")
                        .text(d => `${d.properties.name}, ${states.get(d.id.slice(0, 2)).name}${format(index.get(d.id))}`);
                    
                    //another option
                    svg.selectAll("path.county")
                        .transition()
                        .duration(750)
                        .attr("fill", (d) => {
                        const value1 = d.properties[selectedVar1];
                        const value2 = d.properties[selectedVar2];
                    
                        // Combine values
                        const combinedValue = (value1 + value2) / 2;
                    
                        // Use the appropriate scale based on the selected variable
                        return scale1(combinedValue);
                    });
        
                    // Update legend
                    legendDiamond.append("g")
                        .attr("transform", `translate(-${k * n / 2},-${k * n / 2}) rotate(-45 ${k * n / 2},${k * n / 2})`)
                        .selectAll("rect")
                        .data(d3.cross(d3.range(n), d3.range(n)))
                        .enter()
                        .append("rect")
                        .attr("width", k)
                        .attr("height", k)
                        .attr("x", (d) => d[0] * k)
                        .attr("y", (d) => (n - 1 - d[1]) * k)
                        .attr("fill", (d) => colors[d[1] * n + d[0]])
                        .append("title")
                        .text((d) => {
                        const i = d[0];
                        const j = d[1];
                        return `${labels[1][j]} ${selectedVar2}\n${labels[0][i]} ${selectedVar1}`;
                        });

                    })
                };

        const svg = d3.select("#map")
            .append("svg")
            .attr("width", width)
            .attr("height", height);
        
                // Process data
                const index = d3.index(data, d => d.id);
                const states = d3.map(data, d => ({ id: d.id.slice(0, 2), name: d.state }));
        
                    // Initial map display
                    svg.selectAll("path.county")
                    .data(topojson.feature(us, us.objects.counties).features)
                    .enter()
                    .append("path")
                    .classed("county", true)
                    .attr("fill", (d) => colorScale(d.properties.obesity, d.properties.binge_drinking)) // Use the combined color scale
                    .attr("d", path)
                    .append("title")
                    .text(d => `${d.properties.name}, ${states.get(d.id.slice(0, 2)).name}${format(index.get(d.id))}`);
        
                // State borders
                svg.append("path")
                    .datum(topojson.mesh(us, us.objects.states, (a, b) => a !== b))
                    .attr("fill", "none")
                    .attr("stroke", "white")
                    .attr("stroke-linejoin", "round")
                    .attr("d", path); 1 
        
                // Create initial diamond-shaped legend
                const legendDiamond = svg.append("g")
                    .attr("class", "legend-diamond")
                    .attr("transform", `translate(width - 200, ${height - 100})`); // Adjust position

                const k = 24; // Square size
                const arrow = DOM.uid();

                legendDiamond.append("g")
                    .attr("transform", `translate(-${k * n / 2},-${k * n / 2}) rotate(-45 ${k * n / 2},${k * n / 2})`)
                    .selectAll("rect")
                    .data(d3.cross(d3.range(n), d3.range(n)))
                    .enter()
                    .append("rect")
                    .attr("width", k)
                    .attr("height", k)
                    .attr("x", (d) => d[0] * k)
                    .attr("y", (d) => (n - 1 - d[1]) * k)
                    .attr("fill", (d) => colors[d[1] * n + d[0]])
                    .append("title")
                    .text((d) => {
                    const i = d[0];
                    const j = d[1];
                    return `${labels[1][j]} ${selectedVar2}\n${labels[0][i]} ${selectedVar1}`;
                    });
        
                // Update map on dropdown change
                d3.select("#dropdown-set1").on("change", function() {
                    const selectedVar1 = this.value;
                    updateMap(selectedVar1, d3.select("#dropdown-set2").property("value"));
                });
        
                d3.select("#dropdown-set2").on("change", function() {
                    const selectedVar2 = this.value;
                    updateMap(d3.select("#dropdown-set1").property("value"), selectedVar2);
                });
      
    });
});