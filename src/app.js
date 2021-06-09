var canvas = document.getElementById("gridCanvas");
var canvasSize = "small";
var gtx = canvas.getContext("2d");
canvas.width = 2048;
canvas.height = 1024;

//grid properties
var cellSize = 128;
var w = canvas.width/cellSize;
var h = canvas.height/cellSize;

//polygon properties
//vertex class (x and y are the coordinates)
function v(x,y){
	this.x = x;
	this.y = y;
	this.color = "#565656";
}
//line segment class (a and b are vertices from the vertex class)
function seg(a,b){
	this.a = a;
	this.b = b;
}
var ghostVert = new v(-1,-1);
var ghostSeg = null;
var verticeSet =  [];
var lineSegSet = [];

var placedVert = false;


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

//draws a vertex on the map
function drawVertex(v,color='#676767'){
	let r = 10;
	gtx.beginPath();
	gtx.arc(v.x*cellSize, v.y*cellSize, r, 0, 2 * Math.PI, false);
	gtx.fillStyle = color;
	gtx.fill();
	gtx.lineWidth = 3;
	gtx.strokeStyle = '#000';
	gtx.stroke();
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


	//draw ghost vertice
	if(ghostVert.x >= 0 && ghostVert.y >= 0){
		gtx.globalAlpha = 0.3;
		drawVertex(ghostVert,(on_vertex(ghostVert) ? "#ff0000" : '#676767'));
		gtx.globalAlpha = 1.0;
	}

	//draw ghost segment
	if(ghostSeg != null){

	}

	//draw real vertices
	for(let v=0;v<verticeSet.length;v++){
		let vi = verticeSet[v];
		drawVertex(vi,vi.color);
	}

	gtx.restore();
}

////////////////////////////////////////    GEOMETRIC FUNCTIONS     ///////////////////////////////////


//move the ghost vertice position (a vertice that hasn't been placed by the user yet)
function moveGhostVertice(ev){
	var modX = (ev.offsetX * canvas.width) / canvas.offsetWidth;
	var modY = (ev.offsetY * canvas.height) / canvas.offsetHeight;
	let x = Math.round((modX ) / cellSize);  
	let y = Math.round((modY ) / cellSize); 

  	ghostVert.x = x;
  	ghostVert.y = y;
}

//adds a vertice to the set to be apart of the polygon
function addVertice(v){
	verticeSet.push(v);
}


//removes a vertex from the set and any connecting segments
function deleteVertice(v){
	//remove segments first (save index to remove later)
	let remSegs = []
	for(let l=0;l<lineSegSet.length;l++){
		let seg = lineSegSet[l];
		if(seg.a == v || seg.b == v){
			remSegs.push(l);
		}
	}
	//it's later - remove any bad segments
	for(let l=0;l<remSegs.length;l++){
		lineSegSet.splice(remSegs[l],1);
	}

	//remove from vertex set
	verticeSet.splice(verticeSet.indexOf(v),1);
}

//check if a vertex is intersecting another one
function on_vertex(v){
	for(let i=0;i<verticeSet.length;i++){
		let z = verticeSet[i];
		if(v.x == z.x && v.y == z.y)
			return true;
	}
	return false;
}


//clears the entire grid of vertices and segments
function clearGrid(){
	if(confirm("Are you sure you want to clear the grid?")){
		verticeSet = [];
		lineSegSet = [];
	}
}


////////////////////////////////////    APP EVENTS AND LOOP FUNCTIONS    ////////////////////////////////////

//detect mouse movement on the canvas
canvas.onmousemove = function(e){
	moveGhostVertice(e);
	placedVert = false;
}

//place a vertex if possible
canvas.onmousedown = function(e){
	//place a new vertex
	if(!placedVert){
		placedVert = true;
		addVertice(new v(ghostVert.x, ghostVert.y));
	}
}

canvas.onmouseup = function(e){
	placedVert = false;
}

//detect when cursor moves off screen
canvas.onmouseleave = function(e){
	ghostVert.x = -1;
	ghostVert.y = -1;
}

//app initialization function
function init(){
	setCanvasSize("small",mapBtns[2]);
}

//update loop
function main(){
	requestAnimationFrame(main);

	render();
}

main();