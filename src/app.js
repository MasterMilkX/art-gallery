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
}
//line segment class (a and b are vertices from the vertex class)
function seg(a,b){
	this.a = a;
	this.b = b;
}
var verticeSet =  [];
var lineSegSet = [];



///////////////////////////     GRID RENDERING FUNCTIONS     ///////////////////////////////

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

	gtx.restore();
}


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





function drawGhostVertice(){

}



////////////////////////////////////    APP EVENTS AND LOOP FUNCTIONS    ////////////////////////////////////

//detect mouse movement on the canvas
canvas.onmousemove = function(e){

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