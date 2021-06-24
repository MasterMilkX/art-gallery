var canvas = document.getElementById("gridCanvas");
var canvasSize = "small";
var gtx = canvas.getContext("2d");
canvas.width = 2048;
canvas.height = 1024;

//grid properties
var cellSize = 128;
var w = canvas.width/cellSize;
var h = canvas.height/cellSize;

var debug = document.getElementById("debug");

//polygon properties
//vertex class (x and y are the coordinates, color is the interior fill color of the point)
function ver(x,y,c="#565656"){
	this.x = x;
	this.y = y;
	this.color = c;
	this.equals = function(o){
		return (this.x == o.x) && (this.y == o.y);
	}

}
ver.prototype.toString = function str(){return "(" + this.x + "," + this.y + ")";}

//line segment class (a and b are vertices from the vertex class)
function seg(a,b){
	//order the points from top-left most to bottom-right most
	let first = null;
	if(a.y < b.y)
		first = a;
	else if(a.y > b.y)
		first = b;
	else{
		if(a.x < b.x)
			first = a;
		else if(a.x > b.x)
			first = b;
		else
			console.log("ERROR :: SAME POINT!");
	}

	//assign endpoints
	this.a = first;
	this.b = (first == b ? a : b);

	this.equals = function(o){
		return a.equals(o.a) && b.equals(o.b);
	}
}
seg.prototype.toString = function seg_str(){return this.a.toString() + " -- " + this.b.toString();}

var ghostVert = new ver(-1,-1);
var ghostSeg = null;

var selVert = null;
var selSeg = null;

var verticeSet =  [];
var lineSegSet = [];
var segMatrix = new WeakMap();

var polygon = null;
var triangles = null;
let triColor = ["#f00", "#0f0", "#00f"];

var guardSet = null;
var activeGuardColor = "";
var guardTriangles = {};
var suffGuards = 0;			//sufficient number of guards lowerbound(n/3)

var placedVert = false;
var mouseHeld = false;
var graphChanged = false;


///////////////////////////     GRID RENDERING FUNCTIONS     ///////////////////////////////

//set the canvas grid size
var mapBtns = document.getElementById("mapConfig").getElementsByTagName("button");
function setCanvasSize(size,b=null){
	canvasSize = size;
	if(canvasSize == "small"){
		cellSize = 32;
	}else if(canvasSize == "medium"){
		cellSize = 64;
	}else if(canvasSize == "large"){
		cellSize = 128;
	}

	w = canvas.width/cellSize;
	h = canvas.height/cellSize;

	if(b != null){
		for(let o=0;o<mapBtns.length;o++){
			mapBtns[o].style.backgroundColor = "EFEFEF";
		}
		b.style.backgroundColor = "#ffff00";
	}
}

//draws a vertex on the canvas
function drawVertex(v,color='#676767'){
	let r = 10;

	//fill
	gtx.beginPath();
	gtx.arc(v.x*cellSize, v.y*cellSize, r, 0, 2 * Math.PI, false);
	gtx.fillStyle = color;
	gtx.fill();

	//outline
	let outColor = "#000";									//default color
	if(v == selVert)										//currently selected
		outColor = "#0f0";
	else if(v != ghostVert && ghostVert.x == v.x && ghostVert.y == v.y)		//can select
		outColor = "#F48F06";
	gtx.lineWidth = 5;
	gtx.strokeStyle = outColor;
	gtx.stroke();
}

//draws a line segment on the canvas
function drawLineSeg(s,sty='solid',color='#000', thick='3'){
	gtx.strokeStyle = color;
	gtx.lineWidth = thick;
	gtx.beginPath();
	gtx.setLineDash((sty == "solid" ? [] : [5, 5]));
	gtx.moveTo(s.a.x*cellSize, s.a.y*cellSize);
	gtx.lineTo(s.b.x*cellSize, s.b.y*cellSize);
	gtx.stroke();
	gtx.setLineDash([]);
}

//draw the main polygon 
//extended from: https://stackoverflow.com/questions/4839993/how-to-draw-polygons-on-an-html5-canvas
function drawWholePolygon(){
	//no polygon to draw
	if(polygon == null)
		return;

	gtx.fillStyle = '#cdcdcd';
	gtx.beginPath();
	gtx.moveTo(polygon[0].x*cellSize, polygon[0].y*cellSize);
	for(let v=1;v<polygon.length;v++){
		gtx.lineTo(polygon[v].x*cellSize, polygon[v].y*cellSize);
	}
	gtx.fill();
}

//draws a sub polygon
function drawTriangle(t, color, lines=false, alpha=0.8){
	gtx.fillStyle = color;
	gtx.beginPath();
	gtx.moveTo(t[0].x*cellSize, t[0].y*cellSize);
	for(let v=1;v<t.length;v++){
		gtx.lineTo(t[v].x*cellSize, t[v].y*cellSize);
	}
	
	gtx.globalAlpha = alpha;
	gtx.fill();
	gtx.globalAlpha = 1.0;

	//draw lines on top
	if(lines){
		drawLineSeg(new seg(t[0],t[1]),'solid','#000','1');
		drawLineSeg(new seg(t[1],t[2]),'solid','#000','1');
		drawLineSeg(new seg(t[2],t[0]),'solid','#000','1');
		
	}
}

//don't fill the triangle, only draw the outlines
function outlineTriangle(t){
	drawLineSeg(new seg(t[0],t[1]),'solid','#000','1');
	drawLineSeg(new seg(t[1],t[2]),'solid','#000','1');
	drawLineSeg(new seg(t[2],t[0]),'solid','#000','1');
}


//clears the entire grid of vertices and segments
function clearGrid(skip=false){
	if(skip || confirm("Are you sure you want to clear the grid?")){
		verticeSet = [];
		lineSegSet = [];
		segMatrix = new WeakMap();
		polygon = null;
		triangles = null;
		suffGuards = 0;
		polygonStats();
		resetGuards();
		resetVerticeColors();
		selVert = null;
		selSeg = null;
	}
}

//removes polygons, triangulations, and 3-colorings
function clearPolygons(){
	polygon = null;
	triangles = null;
	resetGuards();
	resetVerticeColors();
}

//draw on the canvas
function render(){
	gtx.save();
	gtx.clearRect(0,0,canvas.width,canvas.height);

	///// BACKGROUND + GRID LINES
	gtx.fillStyle = "#ffffff";
	gtx.fillRect(0,0,canvas.width,canvas.height);

	gtx.strokeStyle = "#ababab";
	gtx.lineWidth = '1';
	//vert lines
	for(let a=0;a<=w;a++){
		gtx.beginPath();
		gtx.moveTo(a*cellSize, 0);
		gtx.lineTo(a*cellSize, canvas.height);
		gtx.stroke();
	}
	//horizontal lines
	for(let b=0;b<=h;b++){
		gtx.beginPath();
		gtx.moveTo(0, b*cellSize);
		gtx.lineTo(canvas.width, b*cellSize);
		gtx.stroke();
	}




	///// POLYGONS

	//draw the entire polygon
	if(polygon != null)
		drawWholePolygon();




	///// LINE SEGMENTS

	//draw ghost line segment
	if(ghostSeg != null){
		drawLineSeg(ghostSeg, "dash", (ghostSeg.valid ? "#000" : "#f00"));
	}

	//draw real segments
	for(let s=0;s<lineSegSet.length;s++){
		drawLineSeg(lineSegSet[s]);
	}

	//draw selected segment
	if(selSeg != null)
		drawLineSeg(selSeg, "solid", "#0f0");


	///// TRIANGULATIONS
	if(triangles != null){
		for(let t=0;t<triangles.length;t++){
			//drawTriangle(triangles[t],triColor[t%triColor.length],true);
			if(activeGuardColor == "")
				outlineTriangle(triangles[t]);
		}
	}

	//show the guards
	if(activeGuardColor != ""){
		let guards = Object.keys(guardTriangles);
		for(let g=0;g<guards.length;g++){
			let curGuard = guardTriangles[guards[g]];
			for(let t=0;t<curGuard.area.length;t++){
				drawTriangle(curGuard.area[t],curGuard.guardColor,false);
			}
		}
	}




	///// VERTICES

	//draw ghost vertex
	if(ghostVert.x >= 0 && ghostVert.y >= 0 && !on_vertex(ghostVert)){
		gtx.globalAlpha = 0.3;
		drawVertex(ghostVert,'#676767');
		gtx.globalAlpha = 1.0;
	}


	//draw real vertices
	for(let v=0;v<verticeSet.length;v++){
		let vi = verticeSet[v];
		//only draw guard vertices
		if(vi.color == activeGuardColor){
			let guards = guardSet[activeGuardColor];
			if(guards.indexOf(vi) != -1)
				drawVertex(vi,vi.color);
		}
		//draw all vertices
		else if(activeGuardColor == ""){
			drawVertex(vi,vi.color);
		}
		
	}


	gtx.restore();
}

function setErrorMsg(s){
	document.getElementById("errorMsg").innerHTML = s;
}

////////////////////////////////////////    GEOMETRIC FUNCTIONS     ///////////////////////////////////

//VERTICES

//determine whether to place a new vertex, select a vertex, deselect a vertex, or create a segment
function vertexAction(){
	selSeg = null;
	setErrorMsg("");
	graphChanged = true;
	resetGuards();

	//empty spot? place a new vertex
	if(!on_vertex(ghostVert) && !on_line(ghostVert)){
		addVertex(new ver(ghostVert.x, ghostVert.y, "#000"));
		return;
	}
	//select a vertex
	else if(selVert == null){
		//console.log("select");
		selVert = getVertex(ghostVert.x, ghostVert.y);
		return;
	}
	//deselect a vertex
	else if(samePos(ghostVert,selVert)){
		//console.log("deselect");
		selVert = null;
		return;
	}
	//create a segment from selected vertex to new vertex
	else if(selVert != null && on_vertex(ghostVert) && !samePos(ghostVert,selVert)){
		//make a new line
		if(ghostSeg != null && ghostSeg.valid){
			addLineSegment(ghostSeg.a, ghostSeg.b);
			ghostSeg = null;
			selVert = null;
			return;
		}
		//select the line
		else{
			selSeg = getSegment(selVert,ghostVert);
			selVert = null;
			return;
		}
	}
}

//move the ghost vertex position (a vertex that hasn't been placed by the user yet)
function moveGhosts(ev){
	var modX = (ev.offsetX * canvas.width) / canvas.offsetWidth;
	var modY = (ev.offsetY * canvas.height) / canvas.offsetHeight;
	let x = Math.round((modX ) / cellSize);  
	let y = Math.round((modY ) / cellSize); 

  	ghostVert.x = x;
  	ghostVert.y = y;
  	/*
  	if(on_line(ghostVert))
  		ghostVert.valid = false;
  	else
  		ghostVert.valid = true;
  	*/

  	//move ghost segment if a selected vertex exists
  	let vb = getVertex(x,y);
  	if(selVert != null && vb != null && !selVert.equals(vb) && !segmentExists(selVert,vb)){
  		ghostSeg = new seg(selVert,vb);

  		//determine if a valid segment (point has <2 segments already and does not intersect another line)
  		if((segMatrix.get(selVert).length >= 2 || segMatrix.get(vb).length >= 2) || intersectsAny(ghostSeg)){
  			ghostSeg.valid = false;
  		}else{
  			ghostSeg.valid = true;
  		}
  	}else{
  		ghostSeg = null;
  	}
}

//adds a vertex to the set to be apart of the polygon
function addVertex(v){
	verticeSet.push(v);
	segMatrix.set(v, []);
}

//get vertex by x and y coordinates
function getVertex(x,y){
	for(let i=0;i<verticeSet.length;i++){
		let v = verticeSet[i];
		if((v.x == x) && (v.y == y))
			return v;
	}
	return null;		//no matches
}

//removes a vertex from the set and any connecting segments
function deleteVertex(v){
	//remove segments first (save index to remove later)
	let remSegs = []
	for(let l=0;l<lineSegSet.length;l++){
		let seg = lineSegSet[l];
		if(seg.a == v || seg.b == v){
			remSegs.push(seg);
		}
	}
	//it's later - remove any bad segments
	for(let l=0;l<remSegs.length;l++){
		lineSegSet.splice(lineSegSet.indexOf(remSegs[l]),1);
		let sa = segMatrix.get(remSegs[l].a)
		sa.splice(sa.indexOf(remSegs[l]),1);
		let sb = segMatrix.get(remSegs[l].b)
		sb.splice(sb.indexOf(remSegs[l]),1);
	}

	//remove from vertex set
	verticeSet.splice(verticeSet.indexOf(v),1);
	segMatrix.delete(v)
}

//check if 2 vertices are on the same position
function samePos(a,b){
	return a.equals(b);
}

//check if a vertex is intersecting another one
function on_vertex(v){
	for(let i=0;i<verticeSet.length;i++){
		let z = verticeSet[i];
		if(samePos(v,z))
			return true;
	}
	return false;
}

//resets the colors of all of the vertices back to black
function resetVerticeColors(){
	for(let v=0;v<verticeSet.length;v++){
		verticeSet[v].color = "#000";
	}
}


// LINE SEGMENTS

//create a line segment from vertex a to vertex b
function addLineSegment(a,b){
	let l = new seg(a,b);
	l.valid = true;
	lineSegSet.push(l);
	segMatrix.get(a).push(l);
	segMatrix.get(b).push(l);
}

function deleteSegment(s){
	//remove from segement set
	lineSegSet.splice(lineSegSet.indexOf(s),1);
	let sa = segMatrix.get(s.a)
	sa.splice(sa.indexOf(s),1);
	let sb = segMatrix.get(s.b)
	sb.splice(sb.indexOf(s),1);
}

//check if a segment for a and b has been made already
function segmentExists(a,b){
	let fakeSeg = new seg(a,b);
	let segSet = segMatrix.get(a);
	for(let s=0;s<segSet.length;s++){
		let l = segSet[s];
		if(l.equals(fakeSeg))
			return true;
	}
	return false;
}	

//get the segment with the same endpoints
function getSegment(a,b){
	let fakeSeg = new seg(a,b);
	let fs =  fakeSeg.toString();
	let segSet = segMatrix.get(a);
	for(let s=0;s<segSet.length;s++){
		let l = segSet[s];
		let ls = l.toString();
		if(ls == fs)
			return l;
	}
	return null;
}

//checks if a line intersects any other line
function intersectsAny(s){
	for(let i=0;i<lineSegSet.length;i++){
		let s2 = lineSegSet[i];
		if(s.equals(s2))		//same segment
			continue;

		if(intersects(s,s2))	//found intersection
			return true;
	}
	return false;
}

//checks if segment m intersects segment n
//from https://stackoverflow.com/questions/9043805/test-if-two-lines-intersect-javascript-function
function intersects(m,n){
	var det, gamma, lambda;
	let a = m.a.x;
	let b = m.a.y;
	let c = m.b.x;
	let d = m.b.y;
	let p = n.a.x;
	let q = n.a.y;
	let r = n.b.x;
	let s = n.b.y;

	det = (c - a) * (s - q) - (r - p) * (d - b);		//determinant of the square points
	if (det === 0) {		//parallel lines
		return false;
	} else {
		lambda = ((s - q) * (r - a) + (p - r) * (s - b)) / det;		//point of intersection on s
		gamma = ((b - d) * (r - a) + (c - a) * (s - b)) / det;		//point of intersection on t
		return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);		//point is on both line segments and not out of bounds
	}
}

//replaces a 3-verticed straight line segment and makes it into a 2-verticed single line segment
function removeStraight(){
	//check if a vertice is in the middle of 3 segments that are straight (mark for removal)
	let rep = [];
	for(let i=0;i<verticeSet.length;i++){
		let v = verticeSet[i];
		let adj = getNeighbors(v);
		if(sameSlope(adj[0],v,adj[1])){
			rep.push(v);
		}
	}

	//replace all of the middle vertices
	for(let j=0;j<rep.length;j++){
		let v = rep[j];
		let adj = getNeighbors(v);
		deleteVertex(v);
		addLineSegment(adj[0],adj[1]);
	}
}


//determine if 2 vertices have same x or y value
function isStraight(a,b){
	return a.x == b.x || a.y == b.y;
}

//get slope of two points
function slope(a,b){
	let m1 = (b.y-a.y);
	let m2 = ((b.x-a.x) == 0 ? 0 : b.x-a.x);
	return m2 == 0 ? null : -m1 / m2;
}

//gets the slope of a line
function lineSlope(l){
	return slope(l.a,l.b);
}

//determine if 3 points (adjacent) have the same slope
function sameSlope(a,b,c){
	return slope(a,b) == slope(b,c);
}

//check if a vertex is placed on a line
//from https://stackoverflow.com/questions/11907947/how-to-check-if-a-point-lies-on-a-line-between-2-other-points/11912171#11912171
function on_line(v){
	for(let i=0;i<lineSegSet.length;i++){
		let l = lineSegSet[i];
		let dxc = v.x - l.a.x;
		let dyc = v.y - l.a.y;

		let dxl = l.b.x - l.a.x;
		let dyl = l.b.y - l.a.y;

		let cross = dxc * dyl - dyc * dxl;
		//not on the line at all
		if(cross != 0)
			continue;

		//more horizontal
		if (Math.abs(dxl) >= Math.abs(dyl)){
			if( dxl > 0 && l.a.x <= v.x && v.x <= l.b.x){
				return true;
			}
			else if(dxl <= 0 && l.b.x <= v.x && v.x <= l.a.x){
				return true;
			}
		}
		//more vertical
		else{
			if( dyl > 0 && l.a.y <= v.y && v.y <= l.b.y){
				return true;
			}
			else if(dyl <= 0 && l.b.y <= v.y && v.y <= l.a.y){
				return true;
			}
		}

	}
	return false;
}


//forms lines around all of the vertices in the order they were placed in
function connectVertices(){
	if(!window.confirm("Connect all vertices in the order they were placed?"))
		return;

	//remove any old segments
	while(lineSegSet.length > 0){
		let s = lineSegSet.pop();
		let sa = segMatrix.get(s.a)
		sa.splice(sa.indexOf(s),1);
		let sb = segMatrix.get(s.b)
		sb.splice(sb.indexOf(s),1);
	}

	//make new segments from the vertices placed
	let c = 0;
	for(let i=1;i<=verticeSet.length;i++){
		let a = verticeSet[i-1];
		let b = verticeSet[i%verticeSet.length];
		if(!segmentExists(a,b)){			//if a segment is not already made
			let ns = new seg(a,b);
			if(!intersectsAny(ns) && segMatrix.get(a).length < 2 && segMatrix.get(b).length < 2){			//make sure the current segment doesn't intersect anything
				addLineSegment(verticeSet[i-1],verticeSet[i%verticeSet.length]);
				ghostSeg = null;
				selVert = null;
				c++;
			}
		}else{
			console.log("seg exists");
		}
	}
}


// POLYGONS

//check if all of the points in the vertice set form a valid polygon
function makePolygon(){
	clearPolygons();
	resetVerticeColors();		//make all vertices black
	resetGuards();

	if(verticeSet.length == 0){
		setErrorMsg("No vertices on map!");
		return null;
	}

	if(verticeSet.length < 3){
		setErrorMsg("Not enough vertices on map!");
		return null;
	}

	//all vertices should have exactly 2 edges (otherwise not a single polygon)
	for(let v=0;v<verticeSet.length;v++){
		if(segMatrix.get(verticeSet[v]).length != 2){
			setErrorMsg("Unconnected vertices!");
			return null;
		}
	}

	//remove any straight vertices
	removeStraight();

	//should form a looped perimeter
	let startPt = verticeSet[Math.floor(Math.random()*verticeSet.length)];	//get a random start point
	let adjPts = getNeighbors(startPt);
	let curPt = adjPts[0];
	let parentPt = startPt;
	let path = [startPt];
	let c = 1;
	//continue around until either all points have been examined or you start at the beginning
	while(c < (verticeSet.length+1) && !curPt.equals(startPt)){
		path.push(curPt);
		adjPts = getNeighbors(curPt);
		let oldCur = curPt;
		curPt = (adjPts[0].equals(parentPt) ? adjPts[1] : adjPts[0]);
		parentPt = oldCur;
		c++;
	}

	//too many polygons on screen
	if(c != verticeSet.length){
		setErrorMsg("More than one polygons on the canvas!");
		console.log(path);
		return null;
	}
	//full polygon
	else if(curPt.equals(startPt)){
		console.log("valid polygon!");
		polygon = path;
		
		graphChanged = false;
		suffGuards = Math.floor(verticeSet.length/3);		//by Chvatal's proof, the sufficient # of guards is lower-bound n/3
		polygonStats();

		return path;
	}

	
}

//get the adjacent vertice neighbors of a point (assuming 2 connected segments)
function getNeighbors(v){
	let segs = segMatrix.get(v);
	let adjV = [];
	for(let s=0;s<segs.length;s++){
		let seg = segs[s];
		if(seg.a.equals(v))
			adjV.push(seg.b);
		else
			adjV.push(seg.a);
	}
	return adjV;
}


//delete a selected segment or vertice 
function deleteAction(){
	if(selVert){
		deleteVertex(selVert);
		selVert = null;
	}else if(selSeg){
		deleteSegment(selSeg);
		selSeg = null;
	}
}

//update information about the polygon
function polygonStats(){
	document.getElementById("verticeCt").innerHTML = "N: " + verticeSet.length;
	document.getElementById("guardCt").innerHTML = "Sufficient Guards: " + suffGuards;
}


////////////////////////////////////     TRIANGULATION AND 3-COLORING     ////////////////////////////////////

//same 2 triangles
function sameTriangle(a,b){
	return b.indexOf(a[0]) != -1 && b.indexOf(a[1]) != -1 && b.indexOf(a[2]) != -1;
}

//same set of triangles
function sameTriangulation(t1,t2){
	if(t1.length != t2.length)
		return false;
	for(let i=0;i<t1.length;i++){
		let flag = false;
		for(let j=0;j<t2.length;j++){
			if(sameTriangle(t1[i],t2[j]))
				flag = true;
		}
		if(!flag)
			return false;
	}
	return true;
}

let rs = 0;

//triangulates the polygon
function triangulate(){
	resetVerticeColors();
	if(polygon == null || graphChanged)
		makePolygon();


	let conv_tri = [];
	
	//try 100 times to make a new triangulation
	for(let f=0;f<100;f++){

		//randomize start position of polygon for different triangulations
		let randStart = 0;
		do{
			randStart = Math.floor(Math.random()*polygon.length);
		}while(randStart == rs);
		rs = randStart;

		//make new polygon from alternate starting position
		let newPolygon = [];
		for(let e=0;e<polygon.length;e++){
			let i = (e+randStart) % polygon.length;
			newPolygon.push(polygon[i]);
		}

		//setup triangulation vertices
		let earpoly = [];
		for(let e=0;e<polygon.length;e++){
			earpoly.push(newPolygon[e].x);
			earpoly.push(newPolygon[e].y);
		}
		//triangulate and convert back to vertex point system
		let cut_tri = earcut(earpoly);

		//console.log(cut_tri);
		conv_tri = [];
		for(let i=0;i<cut_tri.length;i+=3){
			let t = [];
			t.push(newPolygon[cut_tri[i]])
			t.push(newPolygon[cut_tri[i+1]])
			t.push(newPolygon[cut_tri[i+2]])
			conv_tri.push(t);
		}

		if(triangles == null || !sameTriangulation(triangles,conv_tri))
			break;

	}

	triangles = conv_tri;
	return conv_tri;
}

//perform 3-coloring on the triangulation
function color3(){
	if(triangles == null || graphChanged)
		triangulate();

	//pick arbitrary first triangle to color
	let t1 = triangles[Math.floor(Math.random(triangles.length))];

	//color every vertice
	while(t1 != null){
		let availColors = [...triColor];		//colors to use on the triangle

		//remove any colors already in the triangle
		for(let v=0;v<3;v++){
			let ci = availColors.indexOf(t1[v].color)
			if(ci != -1){
				availColors.splice(ci,1);
			}
		}

		//iterate over available colors to color each triangle
		let c = 0;
		for(let i=0;i<t1.length;i++){
			if(t1[i].color != "#000")	//already colored so skip
				continue;
			t1[i].color = availColors[c];
			c++;
		}

		//next triangle with uncolored vertices
		t1 = mostColored();
	}

	sortGuards();

}

//find triangle with most (but not all) colored vertices
//if a triangle has 2 colored, return it
function mostColored(){
	let colorT = null;
	for(let t=0;t<triangles.length;t++){
		let vc = vertColored(triangles[t]);
		if(vc == 2)
			return triangles[t];
		else if(vc == 1 && colorT == null)
			colorT = triangles[t];
	}
	return colorT;
}

//returns number of vertices the are colored for a triangle
function vertColored(t){
	return t.filter(x => x.color != "#000").length;
}

//return the uncolored vertices
function uncolored(t){
	return t.filter(x => x.color == "#000");
}

//group the guards by vertice colors
function sortGuards(){
	guardSet = {"#f00":[], "#0f0":[], "#00f":[]};		//reset guard placements
	for(let v=0;v<verticeSet.length;v++){
		guardSet[verticeSet[v].color].push(verticeSet[v]);
	}
}

//converts an integer to hexadecimal
function int2hex(i){
	return i.toString(16).padStart(2, '0');
}


//find the vertice of a triangle that has the specified color
function triVCol(t,c){
	for(let i=0;i<3;i++){
		if(t[i].color == c)
			return t[i];
	}
	return null;
}

//activate guards and show their range of view
function activateGuards(color){
	if(guardSet == null){
		color3();
	}

	guardTriangles = {};
	let colorGuards = guardSet[color];

	//make all set of color variations from 0-255 of the other alphas
	let o = Math.floor(255/colorGuards.length);		//increments of color
	let cset = [];
	for(let c=0;c<colorGuards.length;c++){
		let c2 = int2hex(c*o);
		if(color == "#f00")
			cset.push("#ff"+c2+c2);
		else if(color == "#0f0")
			cset.push("#"+c2+"ff"+c2);
		else if(color == "#00f")
			cset.push("#"+c2+c2+"ff");
	}	
	//console.log(cset);

	//add all vertices of guard color
	for(let v=0;v<colorGuards.length;v++){
		guardTriangles[v] = {guardColor:cset[v], area:[]};
	}

	//add triangles connected to each guard to represent view area
	for(let t=0;t<triangles.length;t++){
		let tri = triangles[t];
		let myGuard = triVCol(tri,color);
		guardTriangles[colorGuards.indexOf(myGuard)].area.push(triangles[t]);
	}
	activeGuardColor = color;
}

//clear all guard and vertice colorings
function resetGuards(){
	activeGuardColor = "";
	guardSet = null;
	guardTriangles = {};
}


////////////////////////////////////    APP EVENTS AND LOOP FUNCTIONS    ////////////////////////////////////

//detect mouse movement on the canvas
canvas.onmousemove = function(e){
	moveGhosts(e);
	placedVert = false;
}

//place a vertex if possible
canvas.onmousedown = function(e){
	//place a new vertex
	if(!placedVert){
		placedVert = true;
		vertexAction();
	}
	mouseHeld = true;

}

canvas.onmouseup = function(e){
	placedVert = false;
	mouseHeld = false;

	//update stats
	polygonStats();
}

//detect when cursor moves off screen
canvas.onmouseleave = function(e){
	ghostVert.x = -1;
	ghostVert.y = -1;
}

//determine if valud key to press
document.body.addEventListener("keydown", function (e) {
	//delete (backspace or D)
	if(([8,68].indexOf(e.keyCode) > -1)){
		deleteAction();
	}

	//connect all segments
	if(e.keyCode == 65){
		connectVertices();
	}
});


//app initialization function
function init(){
	setCanvasSize("large",mapBtns[2]);
}

//update loop
function main(){
	requestAnimationFrame(main);

	render();

	if(debug){
		//debug.innerHTML = on_vertex(ghostVert);
	}
}

var saveBtn = document.getElementById('downloadArt');
saveBtn.addEventListener('click', function (e) {
    var dataURL = gridCanvas.toDataURL('image/png');
    saveBtn.href = dataURL;
});

main();