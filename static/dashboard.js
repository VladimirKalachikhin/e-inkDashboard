var snd = new Audio("static/img/beep-02.wav");  
//console.log(snd);
function depthAlarm() { 	// 
	setInterval(function(){snd.play();},300)
}
function maxSpeedAlarm() {
	setInterval(function(){snd.play();},1000)
}
function minSpeedAlarm() {
	setInterval(function(){snd.play();},1500)
}
