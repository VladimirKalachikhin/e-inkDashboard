module.exports = function (app) {
/**/
const logError =
app.error ||
(err => {
  console.error(err)
})
const debug =
app.debug ||
(msg => {
  console.log(msg)
})

var plugin = {};
var versionTXT = '0.0.1';

plugin.id = 'e-inkDashboard';
plugin.name = 'e-inkDashboard';
plugin.description = 'e-ink screens - optimized dashboard with some Signal K instruments';

plugin.schema = {
	title: 'e-inkDashboard',
	type: 'object',
	required: ['dashboardPort','refreshInterval'],
	properties: {
		dashboardPort: {
			type: 'string',
			title: 'port of dashboard',
			description: `If this port is busy on your system, change it
			`,
			default: '3531'
		},
		refreshInterval: {
			type: 'number',
			title: 'Dashboard refresh interval, sec',
			description: `Set this as quickly as your e-ink device may.
			`,
			default: 2
		},
	}
};

var unsubscribes = []; 	// массив функций с традиционным именем, в котором функции, которые надо выполнить при остановке плагина

plugin.start = function (options, restartPlugin) {
// 
	app.debug('Plugin started');
	const http = require('http');
	const url = require('url');
	const path = require("path");
    const fs = require("fs");
    const exec = require('child_process');

	const dashboardHost = exec.execSync('hostname --all-ip-addresses').toString().split('\n')[0].trim(); 	// иначе, как вызовом системной команды адрес не узнать. Это ли не жопа?
	const dashboardPort = options.dashboardPort;
	const indexhtml = `<!DOCTYPE html >
<html>
<head>
	<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
	<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
	<meta http-equiv="Pragma" content="no-cache" />
	<meta http-equiv="Expires" content="0" />
	<meta http-equiv='refresh' content='0;url=http://${dashboardHost}:${dashboardPort}/'>
</head>
<body style="text-align: center;">
<span style="font-size: 600%;"><br><br>Dashboard not run</span>
</body>
</html>
	`;
	fs.writeFileSync(__dirname+'/public/index.html',indexhtml);

	// функция, реализующая функциональность сервера. Поскольку в node.js всё через жопу -- нельзя заставить уже имеющийся сервер выполнять дополнительные функции, нодо организовать свой. Ага, на своём порту, б...
	function dashboardServer(request, response) { 	
		//app.debug('request:',request.headers['accept-language']);
		
		// Serve static files
		let uri = url.parse(request.url).pathname;	
		//app.debug('uri',uri);
		if(uri.startsWith('/static')) { 	// только если спросили файл из специального каталога
			//app.debug('path.dirname(__filename):',path.dirname(__filename));
			//app.debug('process.cwd()',process.cwd(),'filename',filename);
			const filename = path.join(__dirname, uri); 	// каталог запущенного файла (ибо рабочий каталог указывает в ~, и почему это так -- неясно), и каталог в запросе
			//app.debug('uri',uri,'filename',filename);
			// синхронно проверяем наличие файла
			if(fs.existsSync(filename)) { 	// файл или каталог есть
				if(fs.statSync(filename).isDirectory()) { 	// если спросили каталог
					response.statusCode = 403;
					response.setHeader('Content-Type', 'text/html; charset=utf-8');
					response.write("403 Forbidden\n");
					response.end();
					return;
				}
				//app.debug('filename',filename);
				try {
					file = fs.readFileSync(filename); 	// синхронно читаем файл. Если асинхронно, то в кривом Node.js будет непонятно, на чём сработает response.write(file), и будет ошибка ERR_STREAM_WRITE_AFTER_END, или response.setHeader, и будет ошибка, что заголовки уже посланы
				}
				catch (err) {
					response.statusCode = 500;
					response.setHeader('Content-Type', 'text/html; charset=utf-8');
					response.write(err + "\n");
					response.end();
					return;
				}
				//app.debug('filename',filename,'\n',file);
				// header и длину ответа устанавливать не будем, потому что всё это надо делать руками. Пусть будет криво -- нефиг пользоваться Node.js
				response.statusCode = 200;
				response.write(file); 	// file -- это buffer. 
				response.end();		
				return;
			}
			else { 	// файла или каталога нет
				response.statusCode = 404;
				response.setHeader('Content-Type', 'text/html; charset=utf-8');
				response.write("404 Not Found\n");
				response.end();
				return;
			}
		}
        
    	// Serve index.
		const inData = url.parse(request.url,true).query;
		//app.debug('inData:',inData);
		let mode;
		if(inData.session) {
			mode = JSON.parse(inData.session);
		}
		else {
			mode = {'mode':null, 'magnetic':null, 'depthAlarm':null, 'minDepthValue':null, 'minSpeedValue':null, 'minSpeedAlarm':null, 'maxSpeedValue':null, 'maxSpeedAlarm':null};
		}
		//app.debug('mode:',mode);
		// Интернационализация
		if(request.headers['accept-language'].includes('ru')){
		//if(false){
			var dashboardHeadingTXT = 'Истинный курс'; 	//  хотя это "путевой угол", "путь"
			var dashboardMagHeadingTXT = 'Магнитный курс';
			var dashboardMagVarTXT = 'Склонение';
			var dashboardSpeedTXT = 'Скорость';
			var dashboardMinSpeedAlarmTXT = 'Скорость меньше допустимой';
			var dashboardMaxSpeedAlarmTXT = 'Скорость больше допустимой';
			var dashboardSpeedMesTXT = 'км/ч';
			var dashboardDepthTXT = 'Глубина';
			var dashboardDepthAlarmTXT = 'Слишком мелко';
			var dashboardDepthMesTXT = 'м';
			var dashboardGNSSoldTXT = 'Данные с приборов устарели';
			var dashboardDepthMenuTXT = 'Опасная глубина';
			var dashboardMinSpeedMenuTXT = 'Минимальная скорость';
			var dashboardMaxSpeedMenuTXT = 'Максимальная скорость';
		}
		else {
			var dashboardHeadingTXT = 'Course';
			var dashboardMagHeadingTXT = 'Magnetic course';
			var dashboardMagVarTXT = 'Magnetic variation';
			var dashboardSpeedTXT = 'Velocity';
			var dashboardMinSpeedAlarmTXT = 'Speed too high';
			var dashboardMaxSpeedAlarmTXT = 'Speed too low';
			var dashboardSpeedMesTXT = 'km/h';
			var dashboardDepthTXT = 'Depth';
			var dashboardDepthAlarmTXT = 'Too shallow';
			var dashboardDepthMesTXT = 'm';
			var dashboardGNSSoldTXT = 'Instrument data old';
			var dashboardDepthMenuTXT = 'Shallow';
			var dashboardMinSpeedMenuTXT = 'Min speed';
			var dashboardMaxSpeedMenuTXT = 'Max speed';
		}
		if(inData.mode) mode.mode = inData.mode;
		if(typeof inData.magnetic !== 'undefined') mode.magnetic = parseInt(inData.magnetic,10);
		let magneticTurn;
		if(mode.magnetic) magneticTurn = 0;
		else magneticTurn = 1;
		let menu = inData['menu'];
		if(inData['submit']) {
			mode.depthAlarm = inData['depthAlarm'];
			mode.minDepthValue = inData['minDepthValue'];
			if(!mode.minDepthValue) mode.depthAlarm = false;

			mode.minSpeedAlarm = inData['minSpeedAlarm'];
			mode.minSpeedValue = inData['minSpeedValue'];
			if(!mode.minSpeedValue) mode.minSpeedAlarm = false;

			mode.maxSpeedAlarm = inData['maxSpeedAlarm'];
			mode.maxSpeedValue = inData['maxSpeedValue'];
			if(!mode.maxSpeedValue) mode.maxSpeedAlarm = false;
		}

		let tpv = {};
		tpv.status = app.getSelfPath('navigation.state') ? app.getSelfPath('navigation.state').value : undefined;
		tpv.speed = app.getSelfPath('navigation.speedOverGround') ? app.getSelfPath('navigation.speedOverGround').value : undefined;
		tpv['track'] = app.getSelfPath('navigation.courseOverGroundTrue') ? app.getSelfPath('navigation.courseOverGroundTrue').value *180/Math.PI : undefined;
		tpv.heading = app.getSelfPath('navigation.headingTrue') ? Math.round(app.getSelfPath('navigation.headingTrue').value *180/Math.PI) : undefined;
		tpv['depth'] = app.getSelfPath('environment.depth.belowSurface') ? app.getSelfPath('environment.depth.belowSurface').value : undefined;
		if(!tpv['depth']) tpv['depth'] = app.getSelfPath('environment.depth.belowTransducer').value;
		tpv.destination = app.getSelfPath('navigation.destination.commonName') ? app.getSelfPath('navigation.destination.commonName').value : undefined;
		tpv.eta = app.getSelfPath('navigation.destination.eta') ? app.getSelfPath('navigation.destination.eta').value : undefined;
		tpv.timestamp = app.getSelfPath('navigation.datetime') ? Math.round(new Date(app.getSelfPath('navigation.datetime').value).getTime()/1000) : Math.round(new Date().getTime()/1000); 	// navigation.datetime -- строка iso-8601
		tpv['magtrack'] = app.getSelfPath('navigation.courseOverGroundMagnetic') ? app.getSelfPath('navigation.courseOverGroundMagnetic').value *180/Math.PI : undefined;
		tpv['magvar'] = app.getSelfPath('navigation.magneticDeviation') ? app.getSelfPath('navigation.magneticDeviation').value *180/Math.PI : undefined;

		let header = '';
		// Оповещения в порядке возрастания опасности, реально сработает последнее
		let alarm = false, alarmJS;
		if(mode.minSpeedAlarm && (tpv['speed']!==null)) {
			if(tpv['speed']*60*60/1000 <= mode.minSpeedValue) {
				mode.mode = 'speed';
				header = dashboardMinSpeedAlarmTXT;
				alarmJS = 'minSpeedAlarm();';
				alarm = true;
			}
		}
		if(mode.maxSpeedAlarm && (tpv['speed']!==null)) {
			if(tpv['speed']*60*60/1000 >= mode.maxSpeedValue) {
				mode.mode = 'speed';
				header = dashboardMaxSpeedAlarmTXT;
				alarmJS = 'maxSpeedAlarm();';
				alarm = true;
			}
		}
		if(mode.depthAlarm && (tpv['depth']!==null)) {
			if(tpv['depth'] <= mode.minDepthValue) {
				mode.mode = 'depth';
				header = dashboardDepthAlarmTXT;
				alarmJS = 'depthAlarm();';
				alarm = true;
			}
		}
		// Что будем рисовать
		let symbol,nextsymbol;		
		if(mode.mode == 'track') {
			// показываемое
			if(mode.magnetic && (tpv['magtrack']!==null)) {
				if(!header) header = dashboardMagHeadingTXT;
				symbol = Math.round(tpv['magtrack']);
			}
			else if((tpv['track']!==null)  && (!mode.magnetic)) {
				if(!header) header = dashboardHeadingTXT;
				symbol = Math.round(tpv['track']); 	// 
			}
			else {
				if(!header) header = dashboardHeadingTXT;
				symbol = '';
				mode.mode = 'depth';
			}
			// следующее
			if(tpv['depth']!==null) {
				nextsymbol = dashboardDepthTXT+" "+(Math.round(tpv['depth']*10)/10)+" "+dashboardDepthMesTXT; 	// 
				nextMode = 'depth';
			}
			else if(tpv['speed']!==null) {
				nextsymbol = dashboardSpeedTXT+" "+(Math.round(tpv['speed']*60*60/100)/10)+" "+dashboardSpeedMesTXT; 	// скорость от signalk - в метрах в секунду
				nextMode = 'speed';
			}
			else nextsymbol = '';
		}
		else if(mode.mode == 'depth'){
			// показываемое
			if(!header) header = dashboardDepthTXT+", "+dashboardDepthMesTXT;
			if(tpv['depth']!==null)	symbol = Math.round(tpv['depth']*10)/10; 	// 
			else mode.mode = 'speed';
			// следующее
			if(tpv['speed']!==null) {
				nextsymbol = dashboardSpeedTXT+" "+(Math.round(tpv['speed']*60*60/100)/10)+" "+dashboardSpeedMesTXT; 	// скорость - в метрах в секунду
				nextMode = 'speed';
			}
			else if(tpv['track']!==null && (!mode.magnetic)) {
				nextsymbol = dashboardHeadingTXT+" "+Math.round(tpv['track']); 	// 
				nextMode = 'track';
			}
			else if(mode.magnetic && tpv['magtrack']!==null) {
				nextsymbol = dashboardMagHeadingTXT+" "+Math.round(tpv['magtrack']); 	// 
				nextMode = 'track';
			}
			else nextsymbol = '';
		}
		else {
			if(tpv['speed']!==null) {
				// показываемое
				if(!header) header = dashboardSpeedTXT+", "+dashboardSpeedMesTXT;
				symbol = Math.round(tpv['speed']*60*60/100)/10; 	// скорость - в метрах в секунду
				// следующее
				if(tpv['track']!==null && (!mode.magnetic)) {
					nextsymbol = dashboardHeadingTXT+" "+Math.round(tpv['track']); 	// 
					nextMode = 'track';
				}
				else if(mode.magnetic && tpv['magtrack']!==null) {
					nextsymbol = dashboardMagHeadingTXT+" "+Math.round(tpv['magtrack']); 	// 
					nextMode = 'track';
				}
				else if(tpv['depth']!==null) {
					nextsymbol = dashboardDepthTXT+" "+(Math.round(tpv['depth']*10)/10)+" "+dashboardDepthMesTXT; 	// 
					nextMode = 'depth';
				}
				else nextsymbol = '';
			}
			else if(tpv['depth']!==null) {
				// показываемое
				if(!header) header = dashboardDepthTXT+", "+dashboardDepthMesTXT;
				symbol = Math.round(tpv['depth']*10)/10; 	// 
				// следующее
				if(tpv['speed']!==null) {
					nextsymbol = dashboardSpeedTXT+" "+(Math.round(tpv['speed']*60*60/100)/10)+" "+dashboardSpeedMesTXT; 	// скорость в метрах в секунду
					nextMode = 'speed';
				}
				else if(tpv['track']!==null && (!mode.magnetic)) {
					nextsymbol = dashboardHeadingTXT+" "+Math.round(tpv['track']); 	// 
					nextMode = 'track';
				}
				else if(mode.magnetic && tpv['magtrack']!==null) {
					nextsymbol = dashboardMagHeadingTXT+" "+Math.round(tpv['magtrack']); 	// 
					nextMode = 'track';
				}
				else nextsymbol = '';
			}
			else if(tpv['track']!==null) {
				// показываемое
				if(!header) header = dashboardHeadingTXT;
				symbol = Math.round(tpv['track']); 	// 
				// следующее
				if(tpv['depth']!==null) {
					nextsymbol = dashboardDepthTXT+" "+(Math.round(tpv['depth']*10)/10)+" "+dashboardDepthMesTXT; 	// скорость в метрах в секунду
					nextMode = 'depth';
				}
				else if(tpv['speed']!==null) {
					nextsymbol = dashboardSpeedTXT+" "+(Math.round(tpv['speed']*60*60/100)/10)+" "+dashboardSpeedMesTXT; 	// скорость в метрах в секунду
					nextMode = 'speed';
				}
				else if(mode.magnetic && tpv['magtrack']!==null) {
					nextsymbol = dashboardMagHeadingTXT+" "+Math.round(tpv['magtrack']); 	// 
					nextMode = 'track';
				}
				else nextsymbol = '';
			}
			else if(tpv['magtrack']!==null) {
				// показываемое
				if(!header) header = dashboardMagHeadingTXT;
				symbol = Math.round(tpv['magtrack']);
				mode.magnetic = TRUE;
				// следующее
				if(tpv['depth']!==null) {
					nextsymbol = dashboardDepthTXT+" "+(Math.round(tpv['depth']*10)/10)+" "+dashboardDepthMesTXT; 	// 
					nextMode = 'depth';
				}
				else if(tpv['speed']!==null) {
					nextsymbol = dashboardSpeedTXT+" "+(Math.round(tpv['speed']*60*60/100)/10)+" "+dashboardSpeedMesTXT; 	// скорость в метрах в секунду
					nextMode = 'speed';
				}
				else if(tpv['track']!==null && (!mode.magnetic)) {
					nextsymbol = dashboardHeadingTXT+" "+Math.round(tpv['track']); 	// 
					nextMode = 'track';
				}
				else nextsymbol = '';
			}
			else {
				// показываемое
				symbol = ''; 	// 
				// следующее
				nextsymbol = '';
			}
		}

		const rumbNames = [' N ','NNE',' NE ','ENE',' E ','ESE',' SE ','SSE',' S ','SSW',' SW ','WSW',' W ','WNW',' NW ','NNW'];
		let rumbNum;
		if(mode.magnetic && (tpv['magtrack']!==null)) rumbNum = Math.round(tpv['magtrack']/22.5);
		else if(tpv['track']!==null) rumbNum = Math.round(tpv['track']/22.5);
		else rumbNum = null;
		if(rumbNum==16) rumbNum = 0;
		//app.debug("rumbNum=",rumbNum);
		let currRumb = ['   ','   ','    ','   ','   ','   ','    ','   ','   ','   ','    ','   ','   ','   ','    ','   '];
		currRumb[rumbNum] = rumbNames[rumbNum];

		// DISPLAY:
		let fontZ = Math. floor(symbol.length/3); 	// считая, что штатный размер шрифта позволяет разместить 4 символа на экране
		if(fontZ>1) {
			fontZ = Math.round((1/fontZ)*100);
			symbol = "<span style='font-size:"+fontZ+"%;'>"+symbol+"</span>";
		}
		uri = encodeURI(`http://${dashboardHost}:${dashboardPort}/?session=${JSON.stringify(mode)}`);

		//app.debug("menu=",menu);
		let responseBody = `<!DOCTYPE html >
<html>
<head>
	<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
	<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
	<meta http-equiv="Pragma" content="no-cache" />
	<meta http-equiv="Expires" content="0" />
		`;
		if(!menu) responseBody += `<meta http-equiv='refresh' content="${options.refreshInterval}; url=${uri}" />`;
		responseBody += `
	<script src="static/dashboard.js">	</script>
		`;
		if(alarm) responseBody += "<script>"+alarmJS+"</script>";
		responseBody += `
	<link rel="stylesheet" href="static/dashboard.css" type="text/css"> 
   <title>e-inkDashboard v.${versionTXT}</title>
</head>
<body style="margin:0; padding:0;">
		`;
		if(menu) { 
			responseBody += `
<form action='${uri}' style = '
	position:fixed;
	right: 5%;
	top: 5%;
	width:53%;
	background-color:lightgrey;
	padding: 1rem;
	font-size: xx-large;
	z-index: 10;
'>
	<table>
		<tr style='height:3rem;'>
			<td style='width:3rem;'><input type='checkbox' name='depthAlarm' value='1' 
			`;
			if(mode.depthAlarm) responseBody += 'checked';
			responseBody += `
			></td><td>${dashboardDepthMenuTXT}, ${dashboardDepthMesTXT}</td><td style='width:10%;'><input type='text' name=minDepthValue value='${mode.minDepthValue?mode.minDepthValue:''}' style='width:95%;font-size:x-large;'></td>
		</tr><tr style='height:3rem;'>
			<td><input type='checkbox' name='minSpeedAlarm' value='1' 
			`;
			if(mode.minSpeedAlarm) responseBody += 'checked';
			responseBody += `
			></td><td>${dashboardMinSpeedMenuTXT}, ${dashboardSpeedMesTXT}</td><td style='width:10%;'><input type='text' name=minSpeedValue value='${mode.minSpeedValue?mode.minSpeedValue:''}' style='width:95%;font-size:x-large;'></td>
		</tr><tr style='height:3rem;'>
			<td><input type='checkbox' name='maxSpeedAlarm' value='1' 
			`;
			if(mode.maxSpeedAlarm) responseBody += 'checked';
			responseBody += `
			></td><td>${dashboardMaxSpeedMenuTXT}, ${dashboardSpeedMesTXT}</td><td style='width:10%;'><input type='text' name=maxSpeedValue value='${mode.maxSpeedValue?mode.maxSpeedValue:''}' style='width:95%;font-size:x-large;'></td>
		</tr><tr>
			<td></td><td><a href='${uri}' style='text-decoration:none;'><input type='button' value='&#x2718;' style='font-size:120%;'></a><input type='submit' name='submit' value='&#x2713;' style='font-size:120%;float:right;'></td><td></td>
		</tr>
	</table>
</form>
			`;
		}
		responseBody += `
<table style='
	border:1px solid; 
	position:fixed; 
	width:100%; 
	height:100%; 
	margin:0; padding:0;
	text-align:center;
	opacity: 0.25;
	z-index: -1;
'>
<tr>
	<td style="width:20%;height:20%;"><span class='big_mid_symbol wb'>${currRumb[14]}</span></td>
	<td style="width:20%;height:20%;"><span class='big_mid_symbol wb'>${currRumb[15]}</span></td>
	<td style="width:20%;height:20%;"><span class='big_mid_symbol wb'>${currRumb[0]}</span></td>
	<td style="width:20%;height:20%;"><span class='big_mid_symbol wb'>${currRumb[2]}</span></td>
</tr>
	<td style="width:20%;height:20%;"><span class='big_mid_symbol wb'>${currRumb[1]}</span></td>
<tr>
	<td style="width:20%;height:20%;"><span class='big_mid_symbol wb'>${currRumb[13]}</span></td>
	<td rowspan="3" colspan="3"></td>
	<td style="width:20%;height:20%;"><span class='big_mid_symbol wb'>${currRumb[3]}</span></td>
</tr>
<tr>
	<td style="width:20%;height:20%;"><span class='big_mid_symbol wb'>${currRumb[12]}</span></td>
	<td style="width:20%;height:20%;"><span class='big_mid_symbol wb'>${currRumb[4]}</span></td>
</tr>
<tr>
	<td style="width:20%;height:20%;"><span class='big_mid_symbol wb'>${currRumb[11]}</span></td>
	<td style="width:20%;height:20%;"><span class='big_mid_symbol wb'>${currRumb[5]}</span></td>
</tr>
<tr>
	<td style="width:20%;height:20%;"><span class='big_mid_symbol wb'>${currRumb[10]}</span></td>
	<td style="width:20%;height:20%;"><span class='big_mid_symbol wb'>${currRumb[9]}</span></td>
	<td style="width:20%;height:20%;"><span class='big_mid_symbol wb'>${currRumb[8]}</span></td>
	<td style="width:20%;height:20%;"><span class='big_mid_symbol wb'>${currRumb[7]}</span></td>
	<td style="width:20%;height:20%;"><span class='big_mid_symbol wb'>${currRumb[6]}</span></td>
</tr>
</table>

<div style = '
	position:absolute;
	left: 0;
	right: 0;
	top: 5%;
	bottom: 0;
	margin: auto;
	width:70%;	
'>
	<div style='text-align:center;'>
		<span class='mid_symbol' style='vertical-align:middle; padding: 0; margin: 0;'>
			${header}
		</span>
	</div>
	<div id='dashboard' class='
		`;
		if(alarm) responseBody += "wb alarm";
		responseBody += `
	' style='text-align:center; padding: 0; margin: 0;'>
		<span class='big_symbol' style='vertical-align:middle;'>
			${symbol}
		</span>
	</div>
	<div style='text-align:center; bottom:0; padding: 0; margin: 0;'>
		<a href="${uri}&magnetic=${magneticTurn}" style="text-decoration:none;">
			<button class='mid_symbol' style='width:14%;vertical-align:middle;' 
		`;
		if(!tpv['magtrack']) responseBody += 'disabled';
		responseBody += `
			 >
				<div style="position:relative;
		`;
		if(!mode.magnetic) responseBody +=  "opacity:0.5;";
		responseBody += `
				">
		`;
		if(tpv['magvar']) responseBody += `<div  class='small_symbol' style='position:absolute;text-align:center;'>${dashboardMagVarTXT}</div><span style='font-size:75%;'>${Math.round(tpv['magvar'])}</span>`;	
		else responseBody += "<img src='static/img/compass.png' alt='magnetic course'>";
		responseBody += `
				</div>
			</button>
		</a>
		<a href="${uri}&mode=${nextMode}" style="text-decoration:none;">
			<button class='mid_symbol' style='width:70%;vertical-align:middle;'>
				<span style=''>
					${nextsymbol}
				</span>
			</button>
		</a>
		<a href="${uri}&menu=
		`;
		if(!menu) responseBody += '1';
		responseBody += `
		" style="text-decoration:none;">
			<button class='mid_symbol' style='width:14%;vertical-align:middle;'>
					<img src='static/img/menu.png' alt='menu'>
			</button>
		</a>
	</div>
</div>

</body>
</html>
		`;
		/*
		response.setHeader('Content-Type', 'application/json');
		const responseBody = { headers, method, url, body };
		response.write(JSON.stringify(responseBody));
		*/
		response.on('error', (err) => {
		  app.debug(err);
		});
		response.statusCode = 200;
		response.setHeader('Content-Type', 'text/html; charset=utf-8');
		response.write(responseBody);
		response.end();

		// END OF NEW STUFF
	}; // end function dashboardServer
	
	const server = http.createServer(dashboardServer); 	// собственно, запустим сервер
	server.listen(dashboardPort, '0.0.0.0', () => {
		app.debug(`Dashboard server running at http://0.0.0.0:${dashboardPort}/`);
	});
	unsubscribes.push(() => { 	// функция остановки сервера при остановке плугина
		server.close();
		app.debug('Dashboard server stopped');
	})
	
}; // end function plugin.start

plugin.stop = function () {
// Here we put logic we need when the plugin stops
	app.debug('Plugin stopped');
	unsubscribes.forEach(f => f());
	unsubscribes = [];
}; // end function plugin.stop

return plugin;
}; //end module.exports








