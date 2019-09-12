var graph;
var mode = "transform";
var addType = 0;
var selection = null;
var speed = 0;
var newNodeIndex = 0;
var autoFilter = ['L','A','FI','FO','FOE','T','Arrow'];
//var centerList = []; // List of 'center' nodes (not half-edges)
var transformCache = []; // Nodes ready for transformation

var nodeValence = {
  'L':  [0,1,1],
  'A':  [0,0,1],
  'FI': [0,0,1],
  'FO': [0,1,1],
  'FOE':[0,1,1],
  'T':  [0],
  'FRIN':[1],
  'FROUT':[0],
  'Arrow':[0,1],
}

/**
 * NEW TRANSFORM SYNTAX
 * 
 * {in:[[type, edge...]...], add:[[type, base, edge...]...], remove:([index...]|true), link:[[edge1,edge2]...]}
 * 
 * Half-edges are a positive or negative number. For example, 1 connects to -1.
 * Negative is input and positive is output, but this is arbitrary and not enforced.
 * `in` is a list of nodes and their edges.
 * The order of `in` is mostly arbitrary, but the first node is used as the target when mousing over nodes.
 * `add` contains the type of node to add, the index of the node to appear on top of, and a list of half-edges to connect to.
 * `remove` is a list of indices of nodes in `in` to be deleted. If `remove` is true instead of a list, remove all input nodes.
 * `link` is a list of pre-existing edge pairs that need to be changed. For example, [[2,-3],[3,-2]] will cross links 2 and 3.
 * 
 * Note that transformations are local. All of the nodes in `in` must form a connected group.
 * 
 */

var transformListOrig = [
  {name:'L-A',   in:[['A',-3,-4,5],['L',-1,2,3]],remove:true,link:[[1,-5],[-2,4]]},
  {name:'FI-FOE',in:[['FOE',-3,4,5],['FI',-1,-2,3]],remove:true,link:[[1,-5],[2,-4]]},
  {name:'L-FO',  in:[['FO',-3,4,5],['L',-1,2,3]],add:[['FOE',1,-1,7,6],['FI',1,-8,-9,2],['L',0,-7,9,4],['L',0,-6,8,5]],remove:true},
  {name:'A-FO',  in:[['FO',-3,4,5],['A',-1,-2,3]],add:[['FOE',1,-1,7,6],['FOE',1,-2,9,8],['A',0,-7,-9,4],['A',0,-6,-8,5]],remove:true},
  {name:'L-FOE', in:[['FOE',-3,4,5],['L',-1,2,3]],add:[['FOE',1,-1,7,6],['FI',1,-8,-9,2],['L',0,-7,9,4],['L',0,-6,8,5]],remove:true},
  {name:'A-FOE', in:[['FOE',-3,4,5],['A',-1,-2,3]],add:[['FOE',1,-1,7,6],['FOE',1,-2,9,8],['A',0,-7,-9,4],['A',0,-6,-8,5]],remove:true},
  {name:'FI-FO', in:[['FO',-3,4,5],['FI',-1,-2,3]],add:[['FO',1,-1,7,6],['FO',1,-2,9,8],['FI',0,-7,-9,4],['FI',0,-6,-8,5]],remove:true},
  {name:'FO-FOE',in:[['FOE',-3,4,5],['FO',-1,2,3]],add:[['FOE',1,-1,7,6],['FI',1,-8,-9,2],['FO',0,-7,9,4],['FO',0,-6,8,5]],remove:true},
  {name:'L-T',   in:[['T',-3],['L',-1,2,3]],remove:[1],link:[[1,-3]]},
  {name:'A-T',   in:[['T',-3],['A',-1,-2,3]],add:[['T',1,-2]],remove:[1],link:[[1,-3]]},
  {name:'FI-T',  in:[['T',-3],['FI',-1,-2,3]],add:[['T',1,-2]],remove:[1],link:[[1,-3]]},
  {name:'FO1-T', in:[['T',-3],['FO',-1,2,3]],remove:true,link:[[1,-2]]},
  {name:'FO2-T', in:[['T',-2],['FO',-1,2,3]],remove:true,link:[[1,-3]]},
  {name:'FOE1-T',in:[['T',-3],['FOE',-1,2,3]],remove:true,link:[[1,-2]]},
  {name:'FOE2-T',in:[['T',-2],['FOE',-1,2,3]],remove:true,link:[[1,-3]]},
  {name:'Clean', in:[['T',-1],[null,1]],remove:true},
  {name:'Comb',  in:[['Arrow',-1,2]],remove:true,link:[1,-2]}
]

var transformListAlt = [
  {name:'L-A',   in:[['A',-3,-4,5],['L',-1,2,3]],remove:true,link:[[1,-5],[-2,4]]},
  {name:'FI-FOE',in:[['FOE',-3,4,5],['FI',-1,-2,3]],remove:true,link:[[1,-5],[2,-4]]},
  {name:'L-FO',  in:[['FO',-3,4,5],['L',-1,2,3]],add:[['FOE',1,-1,7,6],['FI',1,-8,-9,2],['L',0,-7,9,4],['L',0,-6,8,5]],remove:true},
  {name:'A-FO',  in:[['FO',-3,4,5],['A',-1,-2,3]],add:[['FO',1,-1,7,6],['FO',1,-2,9,8],['A',0,-7,-9,4],['A',0,-6,-8,5]],remove:true}, // A-FO generates FO instead of FOE
  {name:'L-FOE', in:[['FOE',-3,4,5],['L',-1,2,3]],add:[['FOE',1,-1,7,6],['FI',1,-8,-9,2],['L',0,-7,9,4],['L',0,-6,8,5]],remove:true},
  {name:'A-FOE', in:[['FOE',-3,4,5],['A',-1,-2,3]],add:[['FOE',1,-1,7,6],['FOE',1,-2,9,8],['A',0,-7,-9,4],['A',0,-6,-8,5]],remove:true},
  {name:'FI-FO', in:[['FO',-3,4,5],['FI',-1,-2,3]],add:[['FO',1,-1,7,6],['FO',1,-2,9,8],['FI',0,-7,-9,4],['FI',0,-6,-8,5]],remove:true},
  {name:'FO-FOE',in:[['FOE',-3,4,5],['FO',-1,2,3]],add:[['FOE',1,-1,7,6],['FI',1,-8,-9,2],['FO',0,-7,9,4],['FO',0,-6,8,5]],remove:true},
  {name:'L-T',   in:[['T',-3],['L',-1,2,3]],remove:[1],link:[[1,-3]]},
  {name:'A-T',   in:[['T',-3],['A',-1,-2,3]],add:[['T',1,-2]],remove:[1],link:[[1,-3]]},
  {name:'FI-T',  in:[['T',-3],['FI',-1,-2,3]],add:[['T',1,-2]],remove:[1],link:[[1,-3]]},
  {name:'FO1-T', in:[['T',-3],['FO',-1,2,3]],remove:true,link:[[1,-2]]},
  {name:'FO2-T', in:[['T',-2],['FO',-1,2,3]],remove:true,link:[[1,-3]]},
  {name:'FOE-T', in:[['T',-3],['FOE',-1,2,3],['T',-2]],remove:[1,2],link:[[1,-3]]}, // FOE-T requires connecting to two T
  {name:'Clean', in:[['T',-1],[null,1]],remove:true},
  {name:'Comb',  in:[['Arrow',-1,2]],remove:true,link:[1,-2]}
] 

transformList = transformListOrig;

function myGraph(selector) {

  // Add and remove elements on the graph object
  this.addNode = function (id, type, x, y) {
    nodes.push({"id": id, "type": type, x: x, y: y, vx:0, vy:0, links:[]});
    //update();
    return nodes[nodes.length-1];
  };

  this.removeNode = function (id) {
    var n = findNode(id);
    while (n.links.length > 0) {
      removeLinkIndex(links.indexOf(n.links[0]));
    }
    nodes.splice(findNodeIndex(id), 1);
    //update();
  };

  var removeLinkIndex = function(i) {
    var slinks = links[i].source.links;
    slinks.splice(slinks.indexOf(links[i]), 1);
    var tlinks = links[i].target.links;
    tlinks.splice(tlinks.indexOf(links[i]), 1);
    links.splice(i, 1);
  }

  this.removeLink = function (source, target) {
    for (var i = 0; i < links.length; i++) {
      if (links[i].source.id == source && links[i].target.id == target) {
        removeLinkIndex(i);
        break;
      }
    }
    //update();
  };

  this.removeAllLinks = function () {
    links.splice(0, links.length);
    update();
  };

  this.removeAllNodes = function () {
    nodes.splice(0, nodes.length);
    links.splice(0, links.length);
    newNodeIndex = 0;
    update();
  };

  this.addLink = function (source, target, value) {
    var nsource = findNode(source);
    var ntarget = findNode(target);
    var newLink = {"source": nsource, "target": ntarget, "value": value};
    nsource.links.push(newLink);
    ntarget.links.push(newLink);
    links.push(newLink);
    //update();
  };

  this.findNode = function (id) {
    return nodes.find(e => e.id == id);
  };

  var findNodeIndex = function (id) {
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].id == id) {
        return i;
      }
    }

  };

  // TODO inline this
  this.getLinked = function (node) {
    return node.links.map(function(e) {
      return (e.source === node ? e.target : e.source);
    });
  }
  
  this.screenToWorldPoint = function(x,y) {
    var svgEl = svg.node();
    var pt = svgEl.createSVGPoint();
        pt.x = x;
        pt.y = y;
        pt =  pt.matrixTransform(vis.node().getCTM().inverse());
    return pt;
  }

  // set up the D3 visualisation in the specified element
  var w = 960,
      h = 800;

  var color = d3.scaleOrdinal()
  .domain(["left","right","out","L","A","FI","FOE","FO","T","FRIN","FROUT","Arrow"])
  .range(["#f00","#00f","#0f0","#f55","#5ff","#ff5","#55f","#5f5","#f5f","#338","#883","#aaa"]);

  var svg = d3.select(selector)
    .append("svg:svg")
    .attr("width", w)
    .attr("height", h)
    .attr("id", "svg")
    .attr("pointer-events", "all")
    .attr("viewBox", "0 0 " + w + " " + h)
    .attr("perserveAspectRatio", "xMinYMid")
    .on("click",backClick)
  
  var vis = svg.append('svg:g');

  var force = d3.forceSimulation();

  this.nodes = force.nodes()
  this.links = [];

  this.update = function () {
    // Update transform list
    findAllTransforms();
    
    // Update graph
    var link = vis.selectAll("line")
    .data(links, function (d) {
      return d.source.id + "-" + d.target.id;
    });

    var linkEnter = link.enter()
      .append("line")
      .attr("id", function (d) {
      return d.source.id + "-" + d.target.id;
    })
      .attr("stroke-width", function (d) {
      return d.value / 10;
    })
      .attr("class", "link")
    //link.append("title")
    //        .text(function (d) {
    //            return d.value;
    //        });
    link.exit().remove();

    link = link.merge(linkEnter)

    var node = vis.selectAll("g.node")
    .data(nodes, function (d) {
      return d.id;
    });

    var nodeEnter = node.enter().append("g")
    .attr("class", "node")

    nodeEnter.append("svg:circle")
      .attr("r", function(d) {
      if (d.type == "left" || d.type == "right" || d.type == "out") {
        return 6;
      } else {
        return 12;
      }
    })
      .attr("id", function (d) {
      return "Node;" + d.id;
    })
      .attr("class", "nodeStrokeClass")
      .attr("fill", function(d) { return color(d.type); })

    //nodeEnter.append("svg:text")
    //        .attr("class", "textClass")
    //        .attr("x", 14)
    //        .attr("y", ".31em")
    //        .text(function (d) {
    //            return d.type;
    //        });

    node.exit().remove();
    
    node = node.merge(nodeEnter)
      .on("click",nodeClick)
      .on("mouseenter",nodeHover)
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended)
      );

    function dragstarted(d) {
      if (!d3.event.active) force.alphaTarget(0.1).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
        
    function dragged(d) {
      d.fx = d3.event.x;
      d.fy = d3.event.y;
    }
        
    function dragended(d) {
      if (!d3.event.active) force.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
    
    // Keep node objects on top of edges
    $(".nodeStrokeClass").each(function( index ) {
      var gnode = this.parentNode;
      gnode.parentNode.appendChild(gnode);
    });
    
    d3.zoom().on("zoom", function zoom_actions(){
      vis.attr("transform", d3.event.transform)
    })(svg)
    // Restart the force layout.
    
    force
      .alpha(.1)
      .alphaDecay(0)
      .force("charge_force", d3.forceManyBody().strength(-50))
      .force("center_x", d3.forceX(w / 2).strength(.05))
      .force("center_y", d3.forceY(h / 2).strength(.05))
      .force("links", d3.forceLink(links).id(function (d) { return d.id; }).distance(function(d) {
        if (d.value == 1) {
          return 20;
        } else {
          return 10;
        }
      }).strength(5))
      .on("tick", function () {

      node.attr("transform", function (d) {
        return "translate(" + d.x + "," + d.y + ")";
      });

      link.attr("x1", function (d) {
        return d.source.x;
      })
        .attr("y1", function (d) {
        return d.source.y;
      })
        .attr("x2", function (d) {
        return d.target.x;
      })
        .attr("y2", function (d) {
        return d.target.y;
      });
    })
    .restart();

    
    /*
    force
      .gravity(.05)
      .charge(-800)
      .friction(0.05)
      .linkDistance( function(d) {
      if (d.value == 1) {
        return 20;
      } else {
        return 10;
      }
    } )
      .linkStrength(5)
      .size([w, h])
      .start();
      */
  };


  // Make it all go
  update();
}

graph = myGraph("#svgdiv")

function setMode(newMode, newType) {
  mode = newMode;
  addType = newType;
  selection = null;
}
function setSpeed(newSpeed) {
  speed = newSpeed;
}

function findLinkedOfType(node, type) {
  var linked = getLinked(node);
  for (var i=0; i<linked.length; i++) {
    var o = linked[i];
    if (o.type == type) {
      return o;
    }
  }
}

function findLinkedHalfEdge(node, type) {
  var linked = getLinked(node);
  for (var i=0; i<linked.length; i++) {
    var o = linked[i];
    if (!isCenter(o)) {
      return o;
    }
  }
}

function findLinkedCenter(node) {
  if (isCenter(node)) {
    return node;
  }
  var linked = getLinked(node);
  for (var i=0; i<linked.length; i++) {
    var o = linked[i];
    if (isCenter(o)) {
      return o;
    }
  }
}

function isCenter(node) {
  return !(node.type == "left" || node.type == "right" || node.type == "out");
}

function findTransform(n1) {
  if (!isCenter(n1)) return;
  
  for (var i=0; i<transformList.length; i++) {
    let trans = transformList[i];
    if (n1.type == trans.in[0][0] && checkTransform(n1, trans)) return trans;
  }
  
  return null;
}

// TODO deal with self-linked nodes
function doTransform(n1, trans) {
  // Link src and dest, deleting other links
  function moveLink(src, dest) {
    if (src) {
      let srcOther = findLinkedHalfEdge(src);
      if (srcOther) {
        removeLink(src.id, srcOther.id);
        removeLink(srcOther.id, src.id);
      }
    }
    if (dest) {
      let destOther = findLinkedHalfEdge(dest);
      if (destOther) {
        removeLink(dest.id, destOther.id);
        removeLink(destOther.id, dest.id);
      }
    }
    
    if (src && dest) addLink(src.id, dest.id, 2);
  }
  
  let transMatch = checkTransform(n1, trans);
  
  if (transMatch == null) {
    console.error("Couldn't match transform");
    return;
  }
  
  // Add nodes
  if (trans.add) {
    for (let template of trans.add) {
      let base = transMatch.nodes[template[1]];
      nodeIndices = addNodeAndEdges(template[0], base.x, base.y);
      for (let i=0; i<nodeIndices.length-1; i++) {
        let src = findNode(nodeIndices[i+1]);
        let dest = transMatch.edges[-template[i+2]];
        
        if (!dest) {
          if (transMatch.edges[template[i+2]]) {
            dest = findLinkedHalfEdge(transMatch.edges[template[i+2]])
          } else {
            // Make an edge if none exists
            transMatch.edges[template[i+2]] = src;
          }
        }
        
        if (dest)
          moveLink(findNode(nodeIndices[i+1]), dest);
      }
    }
  }
  
  // Move links
  if (trans.link) {
    for (let template of trans.link) {
      let src = transMatch.edges[template[0]];
      let dest = transMatch.edges[template[1]];
      
      // Follow links if other side is not part of input
      // This is so that self-linked nodes behave properly
      if (!src) src = findLinkedHalfEdge(transMatch.edges[-template[0]]);
      if (!dest) dest = findLinkedHalfEdge(transMatch.edges[-template[1]]);
      
      moveLink(src, dest);
    }
  }
  
  // Remove nodes
  if (trans.remove === true) {
    for (let i=0; i<trans.in.length; i++) {
      if (trans.in[i][0] !== null)
        removeNodeAndEdges(transMatch.nodes[i]);
    }
  } else if (trans.remove) {
    for (let index of trans.remove) {
      removeNodeAndEdges(transMatch.nodes[index]);
    }
  }
}

function checkTransform(n1, trans) {
  let nodeList = {0:n1};
  let edgeList = {};
  
  //Find involved nodes and edges
  
  let toSearch = [0];
  let foundCount = 0;
  
  // Find the index in trans.in with the associated numbered half-edge,
  // add connection to nodeList
  // Returns false if a conflict was encountered (incorrect ports)
  function addEdge(eindex, edge) {
    if (edgeList[eindex]) {
      // This edge is already explored; return whether it matches previously explored edge
      return (edge == edgeList[eindex]);
    }
    edgeList[eindex] = edge;
    
    let other = findLinkedHalfEdge(edge);
    let otherNode;
    if (other) {
      otherNode = findLinkedCenter(other);
    }
    
    let index = trans.in.findIndex(n => (n.findIndex((e,i) => i>0 && e==-eindex) > -1))
    if (index > -1) {
      let port = trans.in[index].findIndex((e,i) => i>0 && e==-eindex)
      
      if (nodeList[index] === undefined) {
        toSearch.push(index);
      }
      
      if (otherNode) {
        nodeList[index] = otherNode;
        edgeList[-eindex] = other;
      } else {
        nodeList[index] = null;
      }
    }
    
    return true;
  }
  
  while (toSearch.length > 0) {
    foundCount++;
    let index = toSearch.pop();
    let node = nodeList[index];
    let template = trans.in[index];
    
    if (node === null) {
      if (template[0] !== null) return;
      continue;
    }
    
    if (node.type !== template[0]) return;
    
    let e1 = findLinkedOfType(node,"left");
    let e2 = findLinkedOfType(node,"out");
    let e3 = findLinkedOfType(node,"right");
    
    if (!e1 && !e2 && e3) {
      // One edge
      addEdge(template[1], e3);
    } else if (e1 && !e2 && !e3) {
      // One edge
      if (!addEdge(template[1], e1)) return;
    } else if (e1 && !e2 && e3) {
      // Two edges
      if (!addEdge(template[1], e1)) return;
      if (!addEdge(template[2], e3)) return;
    } else {
      // Three edges
      if (!addEdge(template[1], e1)) return;
      if (!addEdge(template[2], e2)) return;
      if (!addEdge(template[3], e3)) return;
    }
  }
  
  if (foundCount != trans.in.length) return;
  
  return {nodes: nodeList, edges: edgeList};
}

function findAllTransforms() {
  transformCache = [];
  
  for (var i=0; i<nodes.length; i++) {
    if (!isCenter(nodes[i])) continue;
    
    var trans = findTransform(nodes[i]);
    
    if (trans) {
      transformCache.push({node: nodes[i], trans: trans})
    }
  }
  
  return transformCache;
}

function updateTransform(node) {
  if (!isCenter(node)) return;
  
  var oldTrans = transformCache.findIndex(e => e.node == node);
  
  var trans = findTransform(node);
  
  if (trans !== null) {
    if (oldTrans == -1) {
      transformCache.push({node: node, trans: trans})
    } else {
      transformCache[oldTrans].trans = trans;
    }
  } else {
    if (oldTrans != -1) {
      transformCache.splice(oldTrans, 1);
    }
  }
}

function removeNodeAndEdges(center) {
  var linked2 = getLinked(center);
  for (var i=0; i<linked2.length; i++) {
    removeNode(linked2[i].id);
  }
  removeNode(center.id);
}

function addNodeAndEdges(type,x,y) {
  x = x || 0;
  y = y || 0;

  var i = newNodeIndex;
  
  var valence = nodeValence[type];
  
  if (!valence) throw new TypeError(`Unknown type ${type}`)

  var portTypes = [["left"],["left","right"],["left","out","right"]][valence.length-1];
  var portList = [i];
  
  for (let k=0; k<valence.length; k++) {
    addNode(i+k+1, portTypes[k], x, y)
    findNode(i+k+1).dir = valence[k];
    portList.push(i+k+1);
  }
  
  addNode(i, type, x, y);
  
  for (let k=0; k<valence.length; k++) {
    addLink(i, i+k+1)
  }
  
  newNodeIndex += valence.length + 1;
  
  return portList;
}

function backClick(d,i) {
  var e = d3.event;
  var pt = screenToWorldPoint(e.offsetX,e.offsetY)
      
  switch (mode) {
    case "add":
      addNodeAndEdges(addType,pt.x,pt.y);
      update();
      break;
    case "delete":
      break;
    case "transform":
      break;
    case "link":
      selection = null;
      break;
  }
}

function nodeClick(d,i) {
  var e = d3.event;
  switch (mode) {
    case "add":
      break;
    case "delete":
      var center = findLinkedCenter(d);

      removeNodeAndEdges(center);
      update();

      break;
    case "transform":
      var trans = findTransform(d);
      if (trans) {
        doTransform(d, trans);
        update();
      }

      break;
    case "link":
      var linkCount = getLinked(d).length;

      if (isCenter(d)) {
        return;
      }

      if (linkCount == 1) {
        if (selection != null && selection.dir != d.dir) {
          addLink(selection.id, d.id, 2);
          update();
          selection = null;
        } else {
          selection = d;
        }
      } else {
        var other = findLinkedHalfEdge(d);
        removeLink(d.id, other.id);
        removeLink(other.id, d.id);
        selection = null;
      }
      update();
      break;
  }

  e.stopPropagation();
}

function nodeHover(d,i) {
  var e = d3.event;
  switch (mode) {
    case "transform":
      var trans = findTransform(d);
      if (trans) {
        doTransform(d, trans);
        update();
      }

      break;
  }
}

function importMol(str) {
  var lines = str.split("\n");
  var edges = {};

  for (var i=0; i<lines.length; i++) {
    var line = lines[i].trim().split(" ");

    if (line[0] == '') continue;
    
    var valence = nodeValence[line[0]];
    if (!valence) {
      showImportError(`line ${i+1}: Unrecognized node type ${line[0]}`)
      return;
    }
    if (line.length-1 < valence.length) {
      showImportError(`line ${i+1}: ${line[0]} has ${line.length-1} edges, expected ${valence.length}`)
    }
    
    var newNode = addNodeAndEdges(line[0]);
    
    for (var k=1; k<newNode.length; k++) {
      if (edges['e'+line[k]]) addLink(edges['e'+line[k]], newNode[k]);
      else edges['e'+line[k]] = newNode[k];
    }
  }
  
  update();
}

function exportMol() {
  var edgeCount = 0;
  var result = "";
  var edges = {};
  
  for (var i=0; i<nodes.length; i++) {
    if (isCenter(nodes[i])) {
      var linked = getLinked(nodes[i]);
      var line = nodes[i].type;
      
      linked.sort((a,b) => a.id - b.id);
      
      for (var k=0; k<linked.length; k++) {
        if (edges[linked[k].id]) {
          line += " " + edges[linked[k].id];
        } else {
          edgeCount ++;
          
          var other = findLinkedHalfEdge(linked[k]);
          if (other != null) {
            edges[other.id] = edgeCount
            line += " " + edgeCount;
          } else {
            line += " free" + edgeCount;
          }
        }
      }
      
      line += "\n";
      result += line;
    }
  }
  
  return result;
}

function doClearImport(textarea) {
  removeAllNodes();
  importMol(textarea.value);
}

function doImport(textarea) {
  importMol(textarea.value);
}

function doExport(textarea) {
  textarea.value = exportMol();
}

function showImportError(e) {
  alert(e);
}

function loop(dt) {
  var anyMoves = false;
  //for (var i=0; i<speed; i++) {
  if (speed == 1 && transformCache.length > 0) {
    var choice = Math.floor(Math.random() * transformCache.length);
    
    var node = transformCache[choice].node;
    var trans = transformCache[choice].trans;
    
    if (autoFilter.indexOf(node.type) != -1) {
      anyMoves = true;
      doTransform(node, trans);
    }
  } else if (speed > 1) {
    var transformCacheAlt = transformCache.map(e=>e.node)
    
    // Shuffle
    for (var i=0; i<transformCacheAlt.length; i++) {
      var k = Math.floor(Math.random() * transformCacheAlt.length);
      
      var tmp = transformCacheAlt[i];
      transformCacheAlt[i] = transformCacheAlt[k];
      transformCacheAlt[k] = tmp;
    }
    
    for (node of transformCacheAlt) {
      if (nodes.indexOf(node) == -1) continue;
      
      var trans = findTransform(node);
      
      if (trans != null && autoFilter.indexOf(node.type) != -1) {
        anyMoves = true;
        doTransform(node, trans);
      }
    }
  }
  if (anyMoves)
    update();
  requestAnimationFrame(loop);
}

loop();
