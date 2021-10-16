module.exports = function (app) {
/**/

var plugin = {};
var versionTXT = '';

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

	const dashboardHost = exec.execSync('hostname --all-ip-addresses').toString().trim().split(' ')[0]; 	// иначе, как вызовом системной команды адрес не узнать. Это ли не жопа?
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
	
	
	//let meta = app.getSelfPath('navigation.position.value');
	//app.debug(meta);
	/*
	app.handleMessage(plugin.id, {
		updates: [
			{
				values: [
					{
						path: 'environment.depth.belowTransducer.meta',
						value: {
							/*
							"displayName": "Shallow hazard",
							"longName": "Shallow hazard",
							"shortName": "Shallow hazard",
							"description": "Alarm by the hazard of shallow",
							"units": "m",
							"timeout": 1,
							"displayScale": {"lower": 1.5, "upper": 5, "type": "linear"},
							"alertMethod": ["visual"],
							"warnMethod": ["visual"],
							"alarmMethod": ["sound", "visual"],
							*//*
							"emergencyMethod": ["sound", "visual"],
							"zones": [
								//{"lower": 31, "state": "normal"},
								{"lower": 0, "upper": 3, "state": "emergency"},
								//{"lower": 4, "upper": 5, "state": "alert", "message": "Shallow!"},
								//{"lower": 2, "upper": 4, "state": "alarm", "message": "Very shallow!"},
								//{"upper": 2, "state": "emergency", "message": "Ground."}
							]
						}
					}
				]
			}
		]
	})
	
	app.handleMessage(plugin.id, {
		updates: [
			{
				values: [
					{
						//path: 'notifications.environment.depth.belowTransducer',
						path: 'notifications.navigation.mob',
						value: {
							'state': 'emergency',
							'method': ['sound'],
							'message': 'Бе-бе-бе'
						}
					}
				]
			}
		]
	})
	*/
	

	// функция, реализующая функциональность сервера. Поскольку в node.js всё через жопу -- нельзя заставить уже имеющийся сервер выполнять дополнительные функции, надо организовать свой. Ага, на своём порту, б...
	function dashboardServer(request, response) { 	
		//app.debug('request:',request.headers['accept-language']);
		//app.debug('request:',request);
		
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
		//app.debug('request.url',request.url);
		const inData = url.parse(request.url,true).query;
		//app.debug('inData:',inData);
		let mode = {}; 	// все данные конкретного клиента. Гоняются к клиенту и обратно в переменной session
		if(inData.session) {
			mode = JSON.parse(inData.session);
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
			var dashboardGNSSoldTXT = 'Данные от приборов устарели';
			var dashboardDepthMenuTXT = 'Опасная глубина';
			var dashboardMinSpeedMenuTXT = 'Минимальная скорость';
			var dashboardMaxSpeedMenuTXT = 'Максимальная скорость';
			var dashboardToHeadingAlarmTXT = 'Отклонение от курса';
			var dashboardKeysMenuTXT = 'Используйте клавиши для смены режимов';
			var dashboardKeySetupTXT = 'Укажите назначение и нажмите клавишу для:';
			var dashboardKeyNextTXT = 'Следующий режим';
			var dashboardKeyPrevTXT = 'Предыдущий режим';
			var dashboardKeyMenuTXT = 'Меню оповещений';
			var dashboardKeyMagneticTXT = 'Магнитный курс';
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
			var dashboardToHeadingAlarmTXT = 'The course is bad';
			var dashboardKeysMenuTXT = 'Use keys to switch the screen mode';
			var dashboardKeySetupTXT = 'Select purpose and press key for:';
			var dashboardKeyNextTXT = 'Next mode';
			var dashboardKeyPrevTXT = 'Previous mode';
			var dashboardKeyMenuTXT = 'Alarm menu';
			var dashboardKeyMagneticTXT = 'Magnetic course';
		}
		if(inData.mode) mode.mode = inData.mode;
		if(typeof inData.magnetic !== 'undefined') mode.magnetic = parseInt(inData.magnetic,10);
		let magneticTurn;
		if(mode.magnetic) magneticTurn = 0;
		else magneticTurn = 1;
		let menu = inData['menu'];
		if(!mode.toHeadingPrecision) mode.toHeadingPrecision = 10;
		if(inData['submit']) {
			//app.debug('inData',inData);
			//app.debug('mode',mode);
			mode.depthAlarm = inData['depthAlarm'];
			mode.minDepthValue = parseFloat(inData['minDepthValue']);
			if(!mode.minDepthValue) mode.depthAlarm = false;

			mode.minSpeedAlarm = inData['minSpeedAlarm'];
			mode.minSpeedValue = parseFloat(inData['minSpeedValue']);
			if(!mode.minSpeedValue) mode.minSpeedAlarm = false;

			mode.maxSpeedAlarm = inData['maxSpeedAlarm'];
			mode.maxSpeedValue = parseFloat(inData['maxSpeedValue']);
			if(!mode.maxSpeedValue) mode.maxSpeedAlarm = false;

			mode.toHeadingAlarm = inData['toHeadingAlarm'];
			mode.toHeadingValue = parseFloat(inData['toHeadingValue']);
			mode.toHeadingPrecision = parseFloat(inData['toHeadingPrecision']);
			mode.toHeadingMagnetic = mode.magnetic;
			if(!mode.toHeadingValue) mode.toHeadingAlarm = false;
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

		// типы данных, которые, собственно, будем показывать 
		const displayData = {  	// 
			'track' : {'variants' : [['track',dashboardHeadingTXT],['magtrack',dashboardMagHeadingTXT]], 	// курс, магнитный курс
				'precision' : 0,
				'multiplicator' : 1
			},
			'speed' : {'variants' : [['speed',dashboardSpeedTXT+', '+dashboardSpeedMesTXT]],	// скорость
				'precision' : 1,
				'multiplicator' : 60*60/1000
			},
			'depth' : {'variants' : [['depth',dashboardDepthTXT+', '+dashboardDepthMesTXT]], 	// глубина
				'precision' : 1,
				'multiplicator' : 1
			}
		};

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
		if(mode.toHeadingAlarm) {
			let theHeading;
			if(mode.toHeadingMagnetic && (typeof(tpv.magtrack) !== 'undefined')) theHeading = tpv.magtrack;
			else theHeading = tpv.track; 	// тревога прозвучит, даже если был указан магнитный курс, но его нет
			const minHeading = toHeadingValue - toHeadingPrecision;
			if(minHeading<0) minHeading = minHeading+360;
			const maxHeading = toHeadingValue + toHeadingPrecision;
			if(maxHeading>=360) maxHeading = maxHeading-360;
			if((theHeading < minHeading) || (theHeading > maxHeading)) {
				mode.mode = 'track';
				header = dashboardToHeadingAlarmTXT;
				alarmJS = 'toHeadingAlarm();';
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
		const parms = Object.keys(displayData);
		const cnt = parms.length;
		let enough = false, prevMode = null, nextMode = null, type, parm, variant, variantType, symbol, nextsymbol;
		for(let i=0;i<cnt;i++){
			type = parms[i];
			parm = displayData[type];
			//app.debug('type=',type,"parm=",parm,'mode=',mode);
			if(!mode.mode) mode.mode = type; 	// что-то не так с типом, сделаем текущий тип указанным
			if(enough) {
				variant = 0;
				if(type == 'track' && mode.magnetic) variant = 1;
				variantType = parm['variants'][variant][0];
				//app.debug('Next variantType =',variantType);
				if(tpv[variantType] == undefined) { 	// но такого типа значения нет в полученных данных.
					if(i == cnt-1) i = -1; 	// цикл по кругу
					continue;
				}
				nextsymbol = parm['variants'][variant][1]+":&nbsp; "+Math.round(tpv[variantType]*parm['multiplicator']*(10**parm['precision']))/(10**parm['precision']);
				nextMode = type;
				//app.debug('symbol =',symbol,'nextsymbol=',nextsymbol,'nextMode=',nextMode,'parm=',parm);
				break;
			}
			if(type != mode.mode) {  	// это не указанный тип
				prevMode = type;
				continue;
			}
			variant = 0;
			if(type == 'track' && mode.magnetic) variant = 1;
			variantType = parm['variants'][variant][0];
			//app.debug('Main variantType =',variantType);
			if(tpv[variantType] == undefined) { 	// но такого типа значения нет в полученных данных.
				mode.mode = null; 	// обозначим, что следующий тип должен стать указанным
				if(i == cnt-1) i = -1; 	// цикл по кругу
				//app.debug('Cycle2 type=',type,"mode.mode=",mode.mode,'i=',i);
				continue;
			}
			header = parm['variants'][variant][1];
			symbol = Math.round(tpv[variantType]*parm['multiplicator']*(10**parm['precision']))/(10**parm['precision']);
			enough = true;
			if(i == cnt-1) i = -1; 	// цикл по кругу
			//app.debug('Cycle type=',type,'prevMode=',prevMode,"mode.mode=",mode.mode,'nextMode=',nextMode,'i=',i,'cnt=',cnt);
		}
		if(!prevMode){
			prevMode = parms[cnt-1];
		}
		//app.debug('Exit cycle type=',type,'prevMode=',prevMode,"mode.mode=",mode.mode,'nextMode=',nextMode);

		const rumbNames = ['&nbsp;&nbsp;N&nbsp;&nbsp;','NNE','&nbsp;&nbsp;NE&nbsp;','ENE','&nbsp;&nbsp;E&nbsp;&nbsp;','ESE','&nbsp;&nbsp;SE&nbsp;','SSE','&nbsp;&nbsp;S&nbsp;&nbsp;','SSW','&nbsp;SW&nbsp;&nbsp;','WSW','&nbsp;&nbsp;W&nbsp;&nbsp;','WNW','&nbsp;NW&nbsp;&nbsp;','NNW'];
		let rumbNum;
		if(mode.magnetic && (tpv['magtrack']!==null)) rumbNum = Math.round(tpv['magtrack']/22.5);
		else if(tpv['track']!==null) rumbNum = Math.round(tpv['track']/22.5);
		else rumbNum = null;
		if(rumbNum==16) rumbNum = 0;
		//app.debug("rumbNum=",rumbNum);
		let currRumb = ['   ','   ','    ','   ','   ','   ','    ','   ','   ','   ','    ','   ','   ','   ','    ','   '];
		currRumb[rumbNum] = rumbNames[rumbNum];

		// DISPLAY:
		let fontZ = Math.floor(symbol.length/3); 	// считая, что штатный размер шрифта позволяет разместить 4 символа на экране
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

<script>
var controlKeys = getCookie('GaladrielMapDashboardControlKeys');
if(controlKeys) {
	controlKeys = JSON.parse(controlKeys);
}
else {
	controlKeys = {
		'upKey': ['ArrowUp',38],
		'downKey': ['ArrowDown',40],
		'menuKey': ['AltRight',18,2],
		'magneticKey': ['KeyM',77]
	}
}
//console.log('controlKeys before',controlKeys);

window.addEventListener("keydown", keySu, true);  

function keySu(event) {
if (event.defaultPrevented) {
	return; // Should do nothing if the default action has been cancelled
}

var handled = false;
if (event.code !== undefined) {
	if(controlKeys.upKey.indexOf(event.code) != -1) handled = 'up';
	else if(controlKeys.downKey.indexOf(event.code) != -1) handled = 'down';
	else if(controlKeys.menuKey.indexOf(event.code) != -1) handled = 'menu';
	else if(controlKeys.magneticKey.indexOf(event.code) != -1) handled = 'magnetic';
}
else if (event.keyCode !== undefined) { // Handle the event with KeyboardEvent.keyCode and set handled true.
	if(controlKeys.upKey.indexOf(event.keyCode) != -1) handled = 'up';
	else if(controlKeys.downKey.indexOf(event.keyCode) != -1) handled = 'down';
	else if(controlKeys.menuKey.indexOf(event.keyCode) != -1) handled = 'menu';
	else if(controlKeys.magneticKey.indexOf(event.keyCode) != -1) handled = 'magnetic';
}
else if (event.location != 0) { // 
	if(controlKeys.upKey.indexOf(event.location) != -1) handled = 'up';
	else if(controlKeys.downKey.indexOf(event.location) != -1) handled = 'down';
	else if(controlKeys.menuKey.indexOf(event.location) != -1) handled = 'menu';
	else if(controlKeys.magneticKey.indexOf(event.location) != -1) handled = 'magnetic';
}

if (handled) {
	event.preventDefault(); // Suppress "double action" if event handled
	switch(handled){
	case 'down':
		//alert(handled);
		window.location.href = '${uri}&mode=${nextMode}';
		break;
	case 'up':
		//alert(handled);
		window.location.href = '${uri}&mode=${prevMode}';
		break;
	case 'menu':
		//alert(handled);
		window.location.href = '${uri}&menu=${menu?'':'1'}';
		break;
	case 'magnetic':
		//alert(handled);
		window.location.href = '${uri}&magnetic=${magneticTurn}';
		break;
	}
}
} // end function keySu

function getCookie(name) {
// возвращает cookie с именем name, если есть, если нет, то undefined
name=name.trim();
var matches = document.cookie.match(new RegExp(
	"(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
	)
);
//console.log('matches',matches);
return matches ? decodeURIComponent(matches[1]) : undefined;
}

</script>
		`;
		if(menu) { 
			responseBody += `
<form action='${uri}' method='get' style = '
	position:fixed;
	right: 5%;
	top: 5%;
	width:53%;
	background-color:lightgrey;
	padding: 1rem;
	font-size: xx-large;
	z-index: 10;
'>
	<input type='hidden' name='session' value=${JSON.stringify(mode)}>
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
			<td><input type='checkbox' name='maxSpeedAlarm' value='1'`;
			if(mode.maxSpeedAlarm) responseBody += 'checked';
			responseBody += `
			></td><td>${dashboardMaxSpeedMenuTXT}, ${dashboardSpeedMesTXT}</td><td style='width:10%;'><input type='text' name=maxSpeedValue value='${mode.maxSpeedValue?mode.maxSpeedValue:''}' style='width:95%;font-size:x-large;'></td>
		</tr><tr style='height:3rem;'>
			<td><input type='checkbox' name='toHeadingAlarm' value='1'`;
			if(mode.toHeadingAlarm) responseBody += 'checked';
			responseBody += ` ></td><td>`;
			if(mode.magnetic){
				if(mode.toHeadingAlarm){
					if(mode.toHeadingMagnetic) responseBody += dashboardMagHeadingTXT;
					else  responseBody += dashboardHeadingTXT;
				}
				else responseBody += dashboardMagHeadingTXT;
			}
			else {
				if(mode.toHeadingAlarm){
					if(mode.toHeadingMagnetic) responseBody += dashboardMagHeadingTXT;
					else  responseBody += dashboardHeadingTXT;
				}
				else responseBody += dashboardHeadingTXT;
			}
			responseBody += `<br> &nbsp; <input type='radio' name='toHeadingPrecision' value='10' `;
			if(mode.toHeadingPrecision == 10) responseBody += 'checked';
			responseBody += `> &plusmn; 10&deg; &nbsp; <input type='radio' name='toHeadingPrecision' value='20' `;
			if(mode.toHeadingPrecision == 20) responseBody += 'checked';
			responseBody += `> &plusmn; 20&deg;<td style='width:10%;'><input type='text' name=toHeadingValue value='`;
			if(mode.magnetic){
				if(mode.toHeadingAlarm) responseBody += mode.toHeadingValue;
				else responseBody += Math.round(tpv.magtrack);
			}
			else {
				if(mode.toHeadingAlarm) responseBody += mode.toHeadingValue;
				else responseBody += Math.round(tpv.track);
			}
			responseBody += `' style='width:95%;font-size:x-large;'></td>
		</tr><tr>
			<td></td><td style='padding-top:2rem;'><a href='${uri}' style='text-decoration:none;'><input type='button' value='&#x2718;' style='font-size:120%;'></a><input type='submit' name='submit' value='&#x2713;' style='font-size:120%;float:right;'></td><td></td>
		</tr>
	</table>
	<div id='jsKeys'>
	</div>
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
	<td style="width:20%;height:20%;"><span class='big_mid_symbol wb'>${currRumb[1]}</span></td>
</tr>
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
		responseBody += `	' style='text-align:center; padding: 0; margin: 0;'>
		<span class='big_symbol' style='vertical-align:middle;'>
			${symbol}
		</span>
	</div>
	<div style='text-align:center; bottom:0; padding: 0; margin: 0;'>
		<a href="${uri}&magnetic=${magneticTurn}" style="text-decoration:none;">
			<button class='mid_symbol' style='width:14%;vertical-align:middle;' `;
		if(!tpv['magtrack']) responseBody += 'disabled';
		responseBody += `>
				<div style="position:relative; `;
		if(!mode.magnetic) responseBody +=  "opacity:0.5;";
		responseBody += `">`;
		if(tpv['magvar']) responseBody += `
				<div  class='small_symbol' style='position:absolute;text-align:center;'>${dashboardMagVarTXT}</div>
				<span style='font-size:75%;'>${Math.round(tpv['magvar'])}</span> `;	
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
		<a href="${uri}&menu=`;
		if(!menu) responseBody += '1';
		responseBody += `
		" style="text-decoration:none;">
			<button class='mid_symbol' style='width:14%;vertical-align:middle;'>
					<img src='static/img/menu.png' alt='menu'>
			</button>
		</a>
	</div>
</div>`;
		if(menu){ 
			responseBody += `
<div id='setKeysWin' style="
display:none;
position:fixed;
right: 20%;
top: 20%;
width:55%;
background-color:grey;
padding: 1rem;
font-size: xx-large;
z-index: 20;
margin-left: auto;
margin-right: auto;
font-size:x-large;
">
${dashboardKeySetupTXT}<br>
<div  style="width:90%;margin:0 auto 0 auto;">
	<table>
	<tr>
	<td style="width:60%;">${dashboardKeyNextTXT}</td>
	<td><input type="radio" name="setKeysSelect" id="downKeyField" onClick="this.value='';downKeyFieldDisplay.innerHTML='';keyCodes.downKey=[];"></td>
	<td style="width:40%;font-size:120%;background-color:white"><span id='downKeyFieldDisplay'></span></td>
	</tr><tr>
	<td style="width:60%;">${dashboardKeyPrevTXT}</td>
	<td><input type="radio" name="setKeysSelect" id="upKeyField" onClick="this.value='';upKeyFieldDisplay.innerHTML='';keyCodes.upKey=[];" ></td>
	<td style="width:40%;font-size:120%;background-color:white"><span id='upKeyFieldDisplay'></span></td>
	</tr><tr>
	<td style="width:60%;">${dashboardKeyMenuTXT}</td>
	<td><input type="radio" name="setKeysSelect" id="menuKeyField" onClick="this.value='';menuKeyFieldDisplay.innerHTML='';keyCodes.menuKey=[];""></td>
	<td style="width:40%;font-size:120%;background-color:white"><span id='menuKeyFieldDisplay'></span></td>
	</tr><tr>
	<td style="width:60%;">${dashboardKeyMagneticTXT}</td>
	<td><input type="radio" name="setKeysSelect" id="magneticKeyField" onClick="this.value='';magneticKeyFieldDisplay.innerHTML='';keyCodes.magneticKey=[];""></td>
	<td style="width:40%;font-size:120%;background-color:white"><span id='magneticKeyFieldDisplay'></span></td>
	</tr>
	</table>
</div>
<div style="width:70%;margin:1em auto 1em auto;">
	<input type='button' value='&#x2718;' style='font-size:120%;' onClick="openSetKeysWin();" ><input type='submit' name='submit' value='&#x2713;' onClick="saveKeys();" style='font-size:120%;float:right;'>
</div>
</div>
<script>
var keyCodes = {};
function jsTest() {
var html = '<div style="width:100%;text-align:right;">';
html += '<span style="font-size:50%;">${dashboardKeysMenuTXT} </span>';
html += ' &nbsp; <a href="#" onClick="openSetKeysWin();" ><img src="static/img/settings.png" alt="define keys" class="small"></a></div>';
jsKeys.innerHTML = html;
} // end function jsTest

function openSetKeysWin() {
/**/
//console.log(controlKeys);
if(setKeysWin.style.display == 'none'){
	window.removeEventListener("keydown", keySu, true);  
	if(controlKeys.upKey) {
		if(controlKeys.upKey.length) {
			upKeyField.value = controlKeys.upKey[0];
			upKeyFieldDisplay.innerHTML = controlKeys.upKey[0]?controlKeys.upKey[0]:'some key';
		}
		else {
			upKeyField.value = null;
			upKeyFieldDisplay.innerHTML = '';
		}
	}
	if(controlKeys.downKey){
		if(controlKeys.downKey.length) {
			downKeyField.value = controlKeys.downKey[0];
			downKeyFieldDisplay.innerHTML = controlKeys.downKey[0]?controlKeys.downKey[0]:'some key';
		}
		else {
			downKeyField.value = null;
			downKeyFieldDisplay.innerHTML = '';
		}
	}
	if(controlKeys.menuKey){
		if(controlKeys.menuKey.length) {
			menuKeyField.value = controlKeys.menuKey[0];
			menuKeyFieldDisplay.innerHTML = controlKeys.menuKey[0]?controlKeys.menuKey[0]:'some key';
		}
		else {
			menuKeyField.value = null;
			menuKeyFieldDisplay.innerHTML = '';
		}
	}
	if(controlKeys.magneticKey){
		if(controlKeys.magneticKey.length) {
			magneticKeyField.value = controlKeys.magneticKey[0];
			magneticKeyFieldDisplay.innerHTML = controlKeys.magneticKey[0]?controlKeys.magneticKey[0]:'some key';
		}
		else {
			magneticKeyField.value = null;
			magneticKeyFieldDisplay.innerHTML = '';
		}
	}
	window.addEventListener("keydown", setKeys, true);  // В читалке Sony можно назначить listener только на window 
	setKeysWin.style.display = 'initial';
}
else {
	setKeysWin.style.display = 'none';
	window.addEventListener("keydown", keySu, true);  
}
} // end function openSetKeysWin()

function setKeys(event) {
/*  */
//console.log(event);
if(event.code == 'Tab' || event.code == 'Esc' || event.code == 'Home') return;
//alert(event.code+','+event.keyCode+','+event.key+','+event.charCode+','+event.location)
event.preventDefault();
//alert(event.code+','+event.keyCode+','+event.key+','+event.charCode+','+event.location);
var keyCode;
if(event.code) keyCode = event.code;
else keyCode = 'some key';
//alert(typeof event.target.id);
if(event.target.id == 'upKeyField') {
	keyCodes['upKey'] = [event.code,event.keyCode,event.key,event.charCode,event.location]
	upKeyFieldDisplay.innerHTML = keyCode;
}
else if(event.target.id == 'downKeyField') {
	keyCodes['downKey'] = [event.code,event.keyCode,event.key,event.charCode,event.location]
	downKeyFieldDisplay.innerHTML = keyCode;
}
else if(event.target.id == 'menuKeyField') {
	keyCodes['menuKey'] = [event.code,event.keyCode,event.key,event.charCode,event.location]
	menuKeyFieldDisplay.innerHTML = keyCode;
}
else if(event.target.id == 'magneticKeyField') {
	keyCodes['magneticKey'] = [event.code,event.keyCode,event.key,event.charCode,event.location]
	magneticKeyFieldDisplay.innerHTML = keyCode;
}
else if(event.target.id == '') {
	keyCodes['downKey'] = [event.code,event.keyCode,event.key,event.charCode,event.location]
	downKeyFieldDisplay.innerHTML = keyCode;
}
//console.log('keyCodes',keyCodes);
} // end function setKeys()

function saveKeys(){
for(var type in keyCodes){
	controlKeys[type] = keyCodes[type];
}
//console.log(controlKeys);
keyCodes = JSON.stringify(controlKeys);
var date = new Date(new Date().getTime()+1000*60*60*24*365).toGMTString();
//alert(keyCodes);
//document.cookie = 'GaladrielMapDashboardControlKeys='+encodeURIComponent(keyCodes)+'; expires='+date+';';
document.cookie = 'GaladrielMapDashboardControlKeys='+keyCodes+'; expires='+date+';';
setKeysWin.style.display = 'none';
} // end function saveKeys

jsTest();
</script>`;
		}
		responseBody += `
</body>
</html>`;
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








