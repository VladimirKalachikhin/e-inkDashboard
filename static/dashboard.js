var snd = new Audio("static/img/beep-02.wav");  
//console.log(snd);
function depthAlarmSound() { 	// 
	setInterval(function(){snd.play();},300)
}
function maxSpeedAlarmSound() {
	setInterval(function(){snd.play();},1000)
}
function minSpeedAlarmSound() {
	setInterval(function(){snd.play();},1500)
}
function toHeadingAlarmSound() {
	setInterval(function(){snd.play();},500)
}
