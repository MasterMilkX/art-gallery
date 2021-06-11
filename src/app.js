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
function v(x,y,c="#565656"){
	this.x = x;
	this.y = y;
	this.color = c;
	this.equals = function(o){
		return (this.x == o.x) && (this.y == o.y);
	}
}
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
var ghostVert = new v(-1,-1);
var ghostSeg = null;
var selVert = null;
var selSeg = null;
var verticeSet =  [];
var lineSegSet = [];
var segMatrix = {};

var placedVert = false;
var mouseHeld = false;


///////////////////////////     GRID RENDERING FUNCTIONS     ///////////////////////////////

//set the canvas grid size
var mapBtns = document.getElementById("mapConfig").getElementsByTagName("button");
function setCanvasSize(size,b=null){
	canvasSize = size;
	if(canvasSize == "large"){
		cellSize = 32;
	}else if(canvasSize == "medium"){
		cellSize = 64;
	}else if(canvasSize == "small"){
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
function drawLineSeg(s,sty='solid',color='#000'){
	gtx.strokeStyle = color;
	gtx.lineWidth = '3';
	gtx.beginPath();
	gtx.setLineDash((sty == "solid" ? [] : [5, 5]));
	gtx.moveTo(s.a.x*cellSize, s.a.y*cellSize);
	gtx.lineTo(s.b.x*cellSize, s.b.y*cellSize);
	gtx.stroke();
	gtx.setLineDash([]);
}


//clears the entire grid of vertices and segments
function clearGrid(){
	if(confirm("Are you sure you want to clear the grid?")){
		verticeSet = [];
		lineSegSet = [];
	}
}

//draw on the canvas
function render(){
	gtx.save();
	gtx.clearRect(0,0,canvas.width,canvas.height);

	//draw background + grid lines
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

	///// LINE SEGMENTS

	//draw ghost line segment
	if(ghostSeg != null){
		drawLineSeg(ghostSeg, "dash");
	}

	//draw real segments
	for(let s=0;s<lineSegSet.length;s++){
		drawLineSeg(lineSegSet[s]);
	}

	//draw selected segment
	if(selSeg != null)
		drawLineSeg(selSeg, "solid", "#0f0");


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
		drawVertex(vi,vi.color);
	}

	gtx.restore();
}

////////////////////////////////////////    GEOMETRIC FUNCTIONS     ///////////////////////////////////

//VERTICES

//determine whether to place a new vertex, select a vertex, deselect a vertex, or create a segment
function verticeAction(){
	selSeg = null;

	//empty spot? place a new vertex
	if(!on_vertex(ghostVert)){
		addVertex(new v(ghostVert.x, ghostVert.y, "#000"));
		return;
	}
	//select a vertex
	else if(selVert == null){
		console.log("select");
		selVert = getVertex(ghostVert.x, ghostVert.y);
		return;
	}
	//deselect a vertex
	else if(samePos(ghostVert,selVert)){
		console.log("deselect");
		selVert = null;
		return;
	}
	//create a segment from selected vertex to new vertex
	else if(selVert != null && on_vertex(ghostVert) && !samePos(ghostVert,selVert)){
		//make a new line
		if(ghostSeg != null){
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

  	//move ghost segment if a selected vertex exists
  	let vb = getVertex(x,y);
  	if(selVert != null && vb != null && !selVert.equals(vb) && !segmentExists(selVert,vb)){
  		ghostSeg = new seg(selVert,vb)
  	}else{
  		ghostSeg = null;
  	}
}

//adds a vertex to the set to be apart of the polygon
function addVertex(v){
	verticeSet.push(v);
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
	}

	//remove from vertex set
	verticeSet.splice(verticeSet.indexOf(v),1);
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


// LINE SEGMENTS

//create a line segment from vertex a to vertex b
function addLineSegment(a,b){
	lineSegSet.push(new seg(a,b));
}

function deleteSegment(s){
	//remove from vertex set
	lineSegSet.splice(lineSegSet.indexOf(s),1);
}

//check if a segment for a and b has been made already
function segmentExists(a,b){
	let fakeSeg = new seg(a,b);
	for(let s=0;s<lineSegSet.length;s++){
		let l = lineSegSet[s];
		if(l.equals(fakeSeg))
			return true;
	}
	return false;
}	

//get the segment with the same endpoints
function getSegment(a,b){
	let fakeSeg = new seg(a,b);
	for(let s=0;s<lineSegSet.length;s++){
		let l = lineSegSet[s];
		if(l.equals(fakeSeg))
			return l;
	}
	return null
}

//draw a segment and place a vertice simultaneously
function segmentAction(){	

}

function deleteAction(){
	if(selVert){
		deleteVertex(selVert);
		selVert = null;
	}else if(selSeg){
		deleteSegment(selSeg);
		selSeg = null;
	}
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
		verticeAction();
	}else{
		segmentAction();
	}
	mouseHeld = true;

}

canvas.onmouseup = function(e){
	placedVert = false;
	mouseHeld = false;
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
});


//app initialization function
function init(){
	setCanvasSize("small",mapBtns[2]);
}

//update loop
function main(){
	requestAnimationFrame(main);

	render();

	if(debug){
		//debug.innerHTML = on_vertex(ghostVert);
	}
}

main();