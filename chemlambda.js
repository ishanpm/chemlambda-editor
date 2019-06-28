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

var transformListOrig = [
  {left:"L",right:"A",action:"remove"},
  {left:"FI",right:"FOE",action:"remove"},
  {left:"L",right:"FO",action:"dist2",t1:"FOE",t2:"FI",t3:"L",t4:"L"},
  {left:"A",right:"FO",action:"dist1",t1:"FOE",t2:"FOE",t3:"A",t4:"A"}, // 3
  {left:"L",right:"FOE",action:"dist2",t1:"FOE",t2:"FI",t3:"L",t4:"L"},
  {left:"A",right:"FOE",action:"dist1",t1:"FOE",t2:"FOE",t3:"A",t4:"A"},
  {left:"FI",right:"FO",action:"dist1",t1:"FO",t2:"FO",t3:"FI",t4:"FI"},
  {left:"FO",right:"FOE",action:"dist2",t1:"FOE",t2:"FI",t3:"FO",t4:"FO"}, // 4
  {left:"L",right:"T",action:"termsplit"},
  {left:"A",right:"T",action:"term"},
  {left:"FI",right:"T",action:"term"},
  {left:"FO",right:"T",action:"term1"},
  {left:"FOE",right:"T",action:"term1"}, // 12
  {left:"null",right:"T",action:"remove1"},
  {left:"null",right:"T",action:"remove1"},
  {left:"any",right:"Arrow",action:"arrow"},
]

var transformListAlt = JSON.parse(JSON.stringify(transformListOrig));
// {left:"A",right:"FO",action:"dist1",t1:"FO",t2:"FO",t3:"A",t4:"A"},
// A-FO generates FO instead of FOE
transformListAlt[3].t1 = "FO";
transformListAlt[3].t2 = "FO";
// {left:"FO",right:"FOE",action:"dist3",t1:"FOE",t2:"FI",t3:"FO",t4:"FO"},
// FO-FOE requires FO to connect to two FOE
transformListAlt[7].action = "dist3";
// {left:"FOE",right:"T",action:"term2"},
// FOE-T requires FOE to connect to two T
transformListAlt[12].action = "term2";

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

  var e1 = findLinkedOfType(n1,"left");
  var e2 = findLinkedHalfEdge(e1);
  var n2 = null;
  var n2type = null;
  
  if (e2 == null) {
    n2type = "null";
  } else {
    n2 = findLinkedCenter(e2);
    n2type = n2.type;
  }

  for (var i=0; i<transformList.length; i++) {
    var trans = transformList[i];
    if (trans.left == n2type && trans.right == n1.type) {
      if (trans.action == "term1") {
        if (e2.type == "out" || e2.type == "right") return trans;
      } else if (trans.action == "term2" || trans.action == "dist3") {
        var e3 = findLinkedOfType(n2,"out");
        var e4 = findLinkedOfType(e3,"left");
        if (e4 != null) {
          var n3 = findLinkedCenter(e4);
          if (e2.type == "right" && n3.type == trans.right) return trans;
        }
      } else if (trans.action == "remove1") {
        return trans;
      } else {
        if (e2.type == "right") return trans;
      }
      return null;
    } else if (trans.right == n1.type && trans.action == "arrow") {
      // Arrow is always good
      return trans;
    }
  }
  
  return null;
}

function doTransform(n1, trans) {
  function moveLink1(s1,d2i) {
    // Connect the other side of s1 to d2
    var s2 = findLinkedHalfEdge(s1);
    var d2 = findNode(d2i);
    if (s2 != null) {
      removeLink(s1.id,s2.id);
      removeLink(s2.id,s1.id);
      addLink(s2.id,d2i,2);
    }
  }
  function moveLink2(s1,d1) {
    // Connect the other side of two half-edges to each other
    var s2 = findLinkedHalfEdge(s1);
    var d2 = findLinkedHalfEdge(d1);
    if (s2 != null) {
      removeLink(s1.id,s2.id);
      removeLink(s2.id,s1.id);
    }
    if (d2 != null) {
      removeLink(d1.id,d2.id);
      removeLink(d2.id,d1.id);
    }
    if (s2 != null && d2 != null && s2 != d1)
      addLink(s2.id,d2.id,2);
  }
  
  var e1 = findLinkedOfType(n1,"left");
  var e2 = findLinkedHalfEdge(e1);
  var n2, a, b, b1, c, d;
  if (e2 != null) {
    n2 = findLinkedCenter(e2);

    a  = findLinkedOfType(n2,"left")
    b  = findLinkedOfType(n2,"out")
    b1 = findLinkedOfType(n2,"right")
  }
  c  = findLinkedOfType(n1,"out")
  d  = findLinkedOfType(n1,"right")

  switch (trans.action) {
    case "arrow":
      // Remove those arrows
      moveLink2(e1,d);
      removeNodeAndEdges(n1);
      break;
    case "remove":
      // L-A and FI-FOE transitions:
      // Link left to right and out to out
      moveLink2(a,d);
      moveLink2(b,c);
      
      removeNodeAndEdges(n1);
      removeNodeAndEdges(n2);
      break;
    case "remove1":
      // Just remove an unconnected T
      removeNodeAndEdges(n1);
      break;
    case "term":
      // Terminator transition for A and FI
      // Make another terminator
      na = addNodeAndEdges("T",n2.x,n2.y);
      
      moveLink1(a,e1.id)
      moveLink1(b,na[1])
      
      removeNodeAndEdges(n2);
      break;
    case "term1": case "term2":
      // Terminator transition for FO and FOE
      // Remove the node and terminator
      if (e2.type == "right") {
        moveLink2(a,b)
      } else {
        moveLink2(a,b1)
      }
      
      removeNodeAndEdges(n1);
      removeNodeAndEdges(n2);
      break;
    case "termsplit":
      // Terminator transition for L
      // Terminate left and leave out alone
      moveLink1(a,e1.id)
      
      removeNodeAndEdges(n2);
      break;
    case "dist1": case "dist2": case "dist3":
      // dist1: Distributive transitions for 2 input nodes,
      // dist2: Distributive transitions for 2 output nodes,
      // dist3: Distributive transitions for 2 output nodes
      //          ensuring both outputs of left node are same
      
      var na = addNodeAndEdges(trans.t1,n2.x,n2.y);
      var nb = addNodeAndEdges(trans.t2,n2.x,n2.y);
      var nc = addNodeAndEdges(trans.t3,n1.x,n1.y);
      var nd = addNodeAndEdges(trans.t4,n1.x,n1.y);
      
      // Interior and exterior ports for nb
      // depend on whether right node is 2 input or 2 output
      var nbint, nbext
      
      if (trans.action == "dist1") {
        nbint = nb[3]; nbext = nb[1];
      } else {
        nbint = nb[1]; nbext = nb[3];
      }
      
      addLink(na[2],nc[1],2);
      addLink(na[3],nd[1],2);
      addLink(nb[2],nc[2],2);
      addLink(nbint,nd[2],2);

      moveLink1(a,na[1]);
      moveLink1(b,nbext);
      moveLink1(c,nc[3]);
      moveLink1(d,nd[3]);
      removeNodeAndEdges(n1);
      removeNodeAndEdges(n2);
      break;
    default:
      console.error("Invalid transformation "+trans.action)
  }

  findAllTransforms();
  //update();
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
