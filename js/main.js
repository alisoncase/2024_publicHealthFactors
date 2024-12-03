function map(mapdata) {
    const width=975,
      height=610;
  
    // Create an svg element to the map
    const svg = d3.select("#map").append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, 975, 610])
        .attr("style", "width: 100%; height: auto; height: intrinsic;");
  
        const data = d3.csv("data/public_health_data.csv")
        .then((data) => {
            data.forEach(row => {
                row.id = row.id.padStart(5, '0');
            //data.forEach((d) => {
            d.obesity = +d.obesity; // type as numeric
            d.diabetes = +d.diabetes;
          });
          // Create an index for data lookup
          const index = d3.index(data, d => d.id);
          return data;
        })
        .then(data => {
        // Define color scales
        const n = 3;
        const x = d3.scaleQuantile(Array.from(data, d => d.diabetes), d3.range(n));
        const y = d3.scaleQuantile(Array.from(data, d => d.obesity), d3.range(n));
      
        // Define color palette
        const colors = [
          "#e8e8e8", "#e4acac", "#c85a5a",
          "#b0d5df", "#ad9ea5", "#985356",
          "#64acbe", "#627f8c", "#574249"
        ];
        
        // Define labels for bins
        const labels = {
          0: "Low",
          1: "",
          2: "High",
        };
      
        // Define color function
        //const color = (d) => {
        //  const value = index.get(d.id).diabetes + x(index.get(d.id).obesity) * n;
        //  return colors[Math.floor(value)];
        //};
        const color = (value) => {
          if (!value) return "#ccc";
          const {diabetes: a, obesity: b} = value;
          return colors[y(b) + x(a) * n];
        };
    
        const path = d3.geoPath();
        // Create the US boundary
        const usa = svg
          .append('g')
          .append('path')
          .datum(topojson.feature(mapdata, mapdata.objects.nation))
          .attr('d', d3.geoPath());
      
        // Create the county boundaries 
        const counties = svg
          .append('g')
          .data(topojson.feature(mapdata, mapdata.objects.counties).features)
          .join('path')
            .attr('stroke', '#444')
            //.attr("fill", color) // Use the defined color function
            .attr("fill", d => color(index.get(d.id)))
          .selectAll('path')
                  
          .attr('vector-effect', 'non-scaling-stroke')
          .attr('d', d3.geoPath());
      });
    
    window.addEventListener('DOMContentLoaded', async (event) => {
      const res = await fetch(`https://cdn.jsdelivr.net/npm/us-atlas@3/counties-albers-10m.json`)   
      const mapJson = await res.json()
      map(mapJson)
    })};