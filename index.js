module.exports = function (app) {
/**/

var plugin = {};
var versionTXT = '';

plugin.id = 'e-inkDashboard';
plugin.name = 'e-inkDashboard';
plugin.description = 'e-ink screens - optimized dashboard with some Signal K instruments';

plugin.schema = {
	'title': 'e-inkDashboard',
	'type': 'object',
	'required': [],
	'properties': {
		'trackProp':{
			'title': '',
			'description': '',
			'type': 'object',
			'properties': {
				'feature':{
					'type': 'string',
					'title': 'Will be displayed as Course:',
					'enum': [
						'Course over ground (COG)',
						'Heading true (HT)',
						'Heading magnetic (HM)',
						'Heading compass (HC)',
					],
					'default': 'Course over ground (COG)'
				},
			},
		},
		'speedProp':{
			'title': '',
			'type': 'object',
			'properties': {
				'feature':{
					'type': 'string',
					'title': 'Will be displayed as Speed:',
					'enum': [
						'Speed ower ground (SOG)',
						'Speed through water (STW)',
					],
					'default': 'Speed ower ground (SOG)'
				},
			},
		},
		'depthProp':{
			'title': '',
			'type': 'object',
			'properties': {
				'feature':{
					'type': 'string',
					'title': 'Will be displayed as Depth:',
					'enum': [
						'Depth below surface (DBS)',
						'Depth below keel (DBK)',
						'Depth below transducer (DBT)',
					],
					'default': 'Depth below surface (DBS)'
				},
			},
		},
		'dashboardPort': {
			'type': 'string',
			'title': 'port of dashboard',
			'description': `Open this port in the firewall. If this port is busy on your system, change it to other
			`,
			'default': '3531'
		},
		'refreshInterval': {
			'type': 'number',
			'title': 'Dashboard refresh interval, sec',
			'description': `Set this as quickly as your e-ink device may.
			`,
			'default': 2
		},
		'checkDataFreshness':{
			'type': 'boolean',
			'title': 'Checking the freshness of data',
			'description': `Does not display out-of-date data. If all devices on your network have the same time 
			(with differents less than 1 sec.) -- check this and you can be sure that you see actual data.
			`,
			'default': true
		},
		'updNotifications':{
			'type': 'boolean',
			'title': 'Update SignalK notifications',
			'description': `Updating the SignalK notification system value zones and raising alarms. Note that
			each instance of the dashboard has its own alarms, but SignalK alert is one for all.
			`,
			'default': true
		},
	}
};

var unsubscribes = []; 	// массив функций с традиционным именем, в котором функции, которые надо выполнить при остановке плагина

plugin.start = function (options, restartPlugin) {
// 
	//app.debug('Plugin started');
	const http = require('http');
	const url = require('url');
	const path = require("path");
    const fs = require("fs");
    const exec = require('child_process');

	//const dashboardHost = exec.execSync('hostname --all-ip-addresses').toString().trim().split(' ')[0]; 	// иначе, как вызовом системной команды адрес не узнать. Это ли не жопа?
	let dashboardHost = exec.execSync('ip -o -4 addr show scope global').toString(); 	// но, однако, нормальный вариант команды есть не во всех системах
	const addrStart = dashboardHost.indexOf('inet')+4;
	const addrEnd = dashboardHost.indexOf('/');
	dashboardHost = dashboardHost.slice(addrStart,addrEnd).trim();
	if(!dashboardHost) dashboardHost = 'localhost';
	//app.debug(dashboardHost);
	const dashboardPort = options.dashboardPort;

	if(options.trackProp.feature.includes('COG')) options.trackProp.feature = 'navigation.courseOverGroundTrue';
	else if(options.trackProp.feature.includes('HT')) options.trackProp.feature = 'navigation.headingTrue';
	else if(options.trackProp.feature.includes('HM')) options.trackProp.feature = 'navigation.headingMagnetic';
	else if(options.trackProp.feature.includes('HC')) options.trackProp.feature = 'navigation.headingCompass';

	if(options.speedProp.feature.includes('SOG')) options.speedProp.feature = 'navigation.speedOverGround';
	else if(options.speedProp.feature.includes('STW')) options.speedProp.feature = 'navigation.speedThroughWater';

	if(options.depthProp.feature.includes('DBS')) options.depthProp.feature = 'environment.depth.belowSurface';
	else if(options.depthProp.feature.includes('DBK')) options.depthProp.feature = 'environment.depth.belowKeel';
	else if(options.depthProp.feature.includes('DBT')) options.depthProp.feature = 'environment.depth.belowTransducer';
	//app.debug('options:',options);
	
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
	
	// функция, реализующая функциональность сервера. Поскольку в node.js всё через жопу -- нельзя заставить уже имеющийся сервер выполнять дополнительные функции, надо организовать свой. Ага, на своём порту, б... Правда, вроде, есть Express, но оно тооооормоооозззззз.
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
			var dashboardMOBTXT = 'Человек за бортом!';
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
			var dashboardMOBTXT = 'A man overboard!';
		}
		if(inData.mode) mode.mode = inData.mode;
		if(typeof inData.magnetic !== 'undefined') mode.magnetic = parseInt(inData.magnetic,10);
		let magneticTurn;
		if(mode.magnetic) magneticTurn = 0;
		else magneticTurn = 1;
		let menu = inData['menu'];
		if(!mode.toHeadingPrecision) mode.toHeadingPrecision = 10;
		
		//app.debug('meta:',app.getSelfPath(options.speedProp.feature+'.meta'));
		
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

			mode.toHeadingAlarm = inData['toHeadingAlarmCheck'];
			mode.toHeadingValue = parseFloat(inData['toHeadingValue']);
			mode.toHeadingPrecision = parseFloat(inData['toHeadingPrecision']);
			mode.toHeadingMagnetic = mode.magnetic;
			if(!mode.toHeadingValue) mode.toHeadingAlarm = false;

			// Теперь в этом уродском SignalK попытаемся выставить границы параметров
			// Считаем, что кроме нас границы никто не ставит, потому что если ставит, то как в них разобраться, чтобы изменить нужное? Агащазкакже, не ставит...
			// Кароче, облом. Изменить meta не удаётся. Кароче, оказалось, что для meta есть специальный синтаксис. Б...
			// Скорость
			if(options.updNotifications){
				if(mode.minSpeedAlarm || mode.maxSpeedAlarm){
					let zones=[],minVal=0,maxVal=102.2;
					if(mode.minSpeedAlarm) {
						minVal = mode.minSpeedValue*1000/(60*60);
						zones.push({lower: 0, upper: minVal, state: "alarm"});
					}
					if(mode.maxSpeedAlarm) {
						maxVal = mode.maxSpeedValue*1000/(60*60);
						zones.push({lower: maxVal, upper: 102.2, state: "alarm"});
					}
					zones.push({lower: minVal, upper: maxVal, state: "normal"});
					setSKzones(options.speedProp.feature,zones);	// установим границы значений
				}
				else {
					setSKzones(options.speedProp.feature,null,null);	// уберём границы значений
					setSKnotification(options.speedProp.feature,null) 	// уберём оповещение
				}
				// Глубина
				if(mode.depthAlarm) {
					let zones=[],minVal=0,maxVal=11000;
					minVal = mode.minDepthValue;
					zones.push({lower: 0, upper: minVal, state: "alarm"});
					zones.push({lower: minVal, upper: maxVal, state: "normal"});
					//app.debug('zones:',zones);
					setSKzones(options.depthProp.feature,zones);	// установим границы значений
				}
				else {
					setSKzones(options.depthProp.feature,null,null);	// уберём границы значений
					setSKnotification(options.depthProp.feature,null) 	// уберём оповещение
				}
				// Направление
				if(mode.toHeadingAlarm) {
					let zones=[],minVal,maxVal;
					minVal = mode.toHeadingValue-mode.toHeadingPrecision;
					if(minVal<0) minVal = minVal+360;
					maxVal = mode.toHeadingValue+mode.toHeadingPrecision;
					if(maxVal>=360) maxVal = maxVal-360;
					zones.push({lower: 0, upper: minVal, state: "alarm"});
					zones.push({lower: maxVal, upper: 360, state: "alarm"});
					zones.push({lower: minVal, upper: maxVal, state: "normal"});
					//app.debug('zones:',zones);
					setSKzones(options.trackProp.feature,zones);	// установим границы значений
				}
				else {
					setSKzones(options.trackProp.feature,null,null);	// уберём границы значений
					setSKnotification(options.trackProp.feature,null) 	// уберём оповещение
				}
			}
		}

		// Получение приборов
		let tpv = {};
		if(app.getSelfPath(options.speedProp.feature)){
			if(!tpv.speed) tpv.speed = {};
			tpv.speed.value = app.getSelfPath(options.speedProp.feature).value;
			tpv.speed.timestamp =  Date.parse(app.getSelfPath(options.speedProp.feature).timestamp);
		}
		if(app.getSelfPath(options.trackProp.feature)){
			if(!tpv.track) tpv.track = {};
			tpv.track.value = app.getSelfPath(options.trackProp.feature).value *180/Math.PI;
			tpv.track.timestamp =  Date.parse(app.getSelfPath(options.trackProp.feature).timestamp);
		}
		if(app.getSelfPath(options.depthProp.feature)){
			if(!tpv.depth) tpv.depth = {};
			tpv.depth.value = app.getSelfPath(options.depthProp.feature).value;
			tpv.depth.timestamp =  Date.parse(app.getSelfPath(options.depthProp.feature).timestamp);
		}
		if(app.getSelfPath('navigation.courseOverGroundMagnetic')){
			if(!tpv.magtrack) tpv.magtrack = {};
			tpv.magtrack.value = app.getSelfPath('navigation.courseOverGroundMagnetic').value *180/Math.PI;
			tpv.magtrack.timestamp =  Date.parse(app.getSelfPath('navigation.courseOverGroundMagnetic').timestamp);
		}
		if(app.getSelfPath('navigation.magneticDeviation')){
		if(!tpv.magvar) tpv.magvar = {};
		tpv.magvar.value = app.getSelfPath('navigation.magneticDeviation').value *180/Math.PI;
		tpv.magvar.timestamp =  Date.parse(app.getSelfPath('navigation.magneticDeviation').timestamp);
		}
		//app.debug('tpv:',tpv);
		
		// Получение MOB
		let mobPosition = null;
		if(app.getSelfPath('notifications.mob.value')){
			let value = app.getSelfPath('notifications.mob.value');
			mode.mob = true;
			if(value.position){	// Это GeoJSON
				// поищем точку, указанную как текущая
				let from=[],to;
				for(let point of value.position.features){	// там не только точки, но и LineString
					if((point.geometry.type == "Point")  && point.properties.current){
						to = point.geometry.coordinates;
						break;
					}
				}
				if(to && app.getSelfPath('navigation.position.value')){
					const selfLonLat = app.getSelfPath('navigation.position.value');
					from.push(selfLonLat.longitude,selfLonLat.latitude);
				}
				mobPosition = [from,to];
				//app.debug('mob data from server',mobPosition);
			}
		}
		else {
			mode.mob = false;
		}
		//app.debug('mode.mob =',mode.mob);

		// перепишем теневое значение mode актуальным, раз такова воля юзера
		const modeStr = JSON.stringify(mode);
		if(modeStr != inData.session) inData.session = modeStr;	

		// Поехали
		let alarm = false, prevMode = null, nextMode = null, currDirectMark='', currTrackMark='';
		let enough = false, type, parm, variant, variantType, symbol='', nextsymbol='', header = '';
		// типы данных, которые, собственно, будем показывать 
		const displayData = {  	// 
			'track' : {'variants' : [['track',dashboardHeadingTXT],['magtrack',dashboardMagHeadingTXT]], 	// курс или магнитный курс
				'precision' : 0,	// точность показываемой цифры, символов после запятой
				'multiplicator' : 1, 	// на что нужно умножить значение для показа
				'fresh': (5+options.refreshInterval) * 1000		// время свежести, миллисек.
			},
			'speed' : {'variants' : [['speed',dashboardSpeedTXT+', '+dashboardSpeedMesTXT]],	// скорость
				'precision' : 1,
				'multiplicator' : 60*60/1000,
				'fresh': (3+options.refreshInterval) * 1000
			},
			'depth' : {'variants' : [['depth',dashboardDepthTXT+', '+dashboardDepthMesTXT]], 	// глубина
				'precision' : 1,
				'multiplicator' : 1,
				'fresh': (2+options.refreshInterval) * 1000
			}
		};

		// Очищаем данные от устаревших
		if(options.checkDataFreshness){
			for(let props in displayData){
				for(let variant of displayData[props].variants){
					if(variant[0] in tpv){
						//if(variant[0]=='depth') console.log('Очищаем данные от устаревших',variant[0],tpv[variant[0]].timestamp,Date.now()-tpv[variant[0]].timestamp,displayData[props].fresh);
						if(tpv[variant[0]] && ((Date.now()-tpv[variant[0]].timestamp)>displayData[props].fresh)){
							app.debug('Property',variant[0],'expired on',(Date.now()-tpv[variant[0]].timestamp)/1000,'sec.');
							delete tpv[variant[0]]; 	// 
						}
					}
				}
			}
		}
		//app.debug('tpv:',tpv);

		// Оповещения в порядке возрастания опасности, реально сработает последнее
		// Похоже, сам SignalK оповещения не выставляет, или я опять чего-то не понял. Teppo традиционно молчит, доку можно понять, что должен. И по идее -- должен, иначе какой смысл назначать zones. Но -- нет.
		let alarmJS;
		if(mode.minSpeedAlarm && tpv['speed'] && (tpv['speed'].value != (null || undefined))) {
			if(tpv['speed'].value*60*60/1000 <= mode.minSpeedValue) {
				mode.mode = 'speed';
				header = dashboardMinSpeedAlarmTXT;
				alarmJS = 'minSpeedAlarmSound();';
				alarm = true;
				if(options.updNotifications) setSKnotification(options.speedProp.feature,{method: ["sound", "visual"],state: "alarm",message: "Low speed!"}); 	// Установим оповещение
			}
			else{
				if(options.updNotifications) setSKnotification(options.speedProp.feature,null); 	// Уберём оповещение
			}
		}
		if(mode.maxSpeedAlarm && tpv['speed'] && (tpv['speed'].value != (null || undefined))) {
			if(tpv['speed'].value*60*60/1000 >= mode.maxSpeedValue) {
				mode.mode = 'speed';
				header = dashboardMaxSpeedAlarmTXT;
				alarmJS = 'maxSpeedAlarmSound();';
				alarm = true;
				if(options.updNotifications) setSKnotification(options.speedProp.feature,{method: ["sound", "visual"],state: "alarm",message: "Hight speed!"}); 	// Установим оповещение
			}
			else{
				if(options.updNotifications) setSKnotification(options.speedProp.feature,null); 	// Уберём оповещение
			}
		}
		let theHeading=null, toHeadingAlarm=false;
		if(mode.toHeadingAlarm && !mode.mob) {
			toHeadingAlarm=true;
			let theHeading=null;	// это будет другой theHeading, используемый только для вычисления тревоги
			if(mode.toHeadingMagnetic && tpv.magtrack) theHeading = tpv.magtrack.value;
			else if(tpv.track) theHeading = tpv.track.value; 	// тревога прозвучит, даже если был указан магнитный курс, но его нет			
			if(theHeading){
				let minHeading = mode.toHeadingValue - mode.toHeadingPrecision;
				if(minHeading<0) minHeading = minHeading+360;
				let maxHeading = mode.toHeadingValue + mode.toHeadingPrecision;
				if(maxHeading>=360) maxHeading = maxHeading-360;
				if((theHeading < minHeading) || (theHeading > maxHeading)) {
					mode.mode = 'track';
					header = dashboardToHeadingAlarmTXT;
					alarmJS = 'toHeadingAlarmSound();';
					alarm = true;
					if(options.updNotifications) setSKnotification(options.trackProp.feature,{method: ["sound", "visual"],state: "alarm",message: "Course lost!"}); 	// Установим оповещение
				}
			}
			else {
				if(options.updNotifications) setSKnotification(options.trackProp.feature,null); 	// Уберём оповещение
			}
		}
		if(mode.depthAlarm && tpv['depth'] && (tpv['depth'].value != (null || undefined))) {
			if(tpv['depth'].value <= mode.minDepthValue) {
				mode.mode = 'depth';
				header = dashboardDepthAlarmTXT;
				alarmJS = 'depthAlarmSound();';
				alarm = true;
				if(options.updNotifications) setSKnotification(options.depthProp.feature,{method: ["sound", "visual"],state: "alarm",message: "Shallow!"}); 	// Установим оповещение
			}
			else {
				if(options.updNotifications) setSKnotification(options.depthProp.feature,null); 	// Уберём оповещение
			}
		}
		//app.debug('alarm=',alarm,'mode.mode=',mode.mode,'mode.mob=',mode.mob);

		// Что будем рисовать
		const parms = Object.keys(displayData);
		const cnt = parms.length;
		let cycle = null;
		for(let i=0;i<cnt;i++){ 	// 
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
				if(cycle == variantType){ 	// прокрутили до ранее выбранного типа, но нечего показывать
					nextsymbol = '';
					break;
				}
				nextsymbol = parm['variants'][variant][1]+":&nbsp; "+Math.round(tpv[variantType].value*parm['multiplicator']*(10**parm['precision']))/(10**parm['precision']);
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
			//app.debug('Main variantType =',variantType,tpv);
			if(tpv[variantType] == undefined) { 	// но такого типа значения нет в полученных данных.
				mode.mode = null; 	// обозначим, что следующий тип должен стать указанным
				if(cycle == variantType){ 	// прокрутили все типы, но нечего показывать
					symbol = 'No data';	
					break;
				}
				if(!cycle) cycle = variantType;	// запомним этот тип того, что нужно показывать для проверки зацикливания, если ничего не осталось показывать
				if(i == cnt-1) i = -1; 	// цикл по кругу
				//app.debug('Cycle2 type=',type,"mode.mode=",mode.mode,'i=',i);
				continue;
			}
			header = parm['variants'][variant][1];
			symbol = Math.round(tpv[variantType].value*parm['multiplicator']*(10**parm['precision']))/(10**parm['precision']);
			enough = true;
			cycle = variantType;	// сдедующий тип будем искать по кругу до выбранного
			if(i == cnt-1) i = -1; 	// цикл по кругу
			//app.debug('Cycle type=',type,'prevMode=',prevMode,"mode.mode=",mode.mode,'nextMode=',nextMode,'i=',i,'cnt=',cnt);
		}
		if(!prevMode){
			prevMode = parms[cnt-1];
		}
		//app.debug('Exit cycle type=',type,'prevMode=',prevMode,"mode.mode=",mode.mode,'nextMode=',nextMode);

		if(mode.toHeadingMagnetic && tpv['magtrack']) theHeading = tpv['magtrack'].value;
		else if(tpv['track']) theHeading = tpv['track'].value; 	// 
		else theHeading = null;

		const rumbNames = ['&nbsp;&nbsp;&nbsp;N&nbsp;&nbsp;&nbsp;','NNE','&nbsp;NE&nbsp;','ENE','&nbsp;&nbsp;E&nbsp;&nbsp;','ESE','&nbsp;SE&nbsp;','SSE','&nbsp;&nbsp;&nbsp;S&nbsp;&nbsp;&nbsp;','SSW','&nbsp;SW&nbsp;','WSW','&nbsp;&nbsp;W&nbsp;&nbsp;','WNW','&nbsp;NW&nbsp;','NNW'];
		let rumbNum;
		if(theHeading !== null){
			rumbNum = theHeading;
			rumbNum = Math.round(rumbNum/22.5);
			if(rumbNum==16) rumbNum = 0;
		}
		else rumbNum = null;
		let currRumb = ['   ','   ','    ','   ','   ','   ','    ','   ','   ','   ','    ','   ','   ','   ','    ','   '];
		currRumb[rumbNum] = rumbNames[rumbNum];

		let MOBtxt = '';
		if(mode.mob) {
			MOBtxt = `<div style="position:absolute;left:1%;right:auto;top:20%;opacity: 0.3;"  class="big_mid_symbol wb"><span style="">${dashboardMOBTXT}</span></div>`;
			if(mobPosition){
				toHeadingAlarm = true;
				mode.toHeadingValue = Math.round(bearing(mobPosition[0],mobPosition[1]));
				//app.debug('mode.toHeadingValue=',mode.toHeadingValue,mobPosition[0],mobPosition[1]);
			}
		}

		let percent=null;
		if(toHeadingAlarm) {
			//mode.toHeadingValue =30;
			// Метка указанного направления
			if((mode.toHeadingValue>315)&&(mode.toHeadingValue<360)){
				percent = 100 - (mode.toHeadingValue - 313)*100/90;
				currDirectMark = `<img src='static/img/markNNW.png' style='display:block;position:fixed;top:0;right:${percent}%;' class='markVert'>`;
			} 
			else if(mode.toHeadingValue == 0){
				currDirectMark = `<img src='static/img/markN.png' style='display:block;position:fixed;top:0;left:49.5%;' class='markVert'>`;
			}
			else if((mode.toHeadingValue>0)&&(mode.toHeadingValue<45)){
				percent = (mode.toHeadingValue+43)*100/90;
				currDirectMark = `<img src='static/img/markNNE.png' style='display: block;position: fixed;top:0;left:${percent}%;' class='markVert'>`;
			}
			else if(mode.toHeadingValue == 45){
				currDirectMark = `<img src='static/img/markNE.png' style='display: block;position: fixed;top:0;right:0;' class='markVert'>`;
			}
			else if((mode.toHeadingValue > 45) && (mode.toHeadingValue < 90)){
				percent = 100 - (mode.toHeadingValue-43)*100/90;
				currDirectMark = `<img src='static/img/markENE.png' style='display: block;position: fixed;right:0;bottom:${percent}%;' class='markHor'>`;
			}
			else if(mode.toHeadingValue == 90){
				currDirectMark = `<img src='static/img/markE.png' style='display: block;position: fixed;right:0;top:49%;' class='markHor'>`;
			}
			else if((mode.toHeadingValue > 90) && (mode.toHeadingValue < 135)){
				percent = (mode.toHeadingValue-47)*100/90;
				currDirectMark = `<img src='static/img/markESE.png' style='display: block;position: fixed;right:0;top:${percent}%;' class='markHor'>`;
			}
			else if(mode.toHeadingValue == 135){
				currDirectMark = `<img src='static/img/markSE.png' style='display: block;position: fixed;bottom:0;right:0;' class='markHor'>`;
			}
			else if((mode.toHeadingValue>135)&&(mode.toHeadingValue<180)){
				percent = 100 - (mode.toHeadingValue-133)*100/90;
				currDirectMark = `<img src='static/img/markSSE.png' style='display: block;position: fixed;bottom:0;left:${percent}%;' class='markVert'>`;
			}
			else if(mode.toHeadingValue == 180){
				currDirectMark = `<img src='static/img/markS.png' style='display: block;position: fixed;bottom:0;left:49.5%;' class='markVert'>`;
			}
			else if((mode.toHeadingValue>180)&&(mode.toHeadingValue<225)){
				percent = (mode.toHeadingValue-137)*100/90;
				currDirectMark = `<img src='static/img/markSSW.png' style='display: block;position: fixed;bottom:0;right:${percent}%;' class='markVert'>`;
			}
			else if(mode.toHeadingValue==225){
				currDirectMark = `<img src='static/img/markSW.png' style='display: block;position: fixed;bottom:0;left:0;' class='markHor'>`;
			}
			else if((mode.toHeadingValue>225)&&(mode.toHeadingValue<270)){
				percent = 100 - (mode.toHeadingValue-223)*100/90;
				currDirectMark = `<img src='static/img/markWSW.png' style='display:block;position:fixed;left:0;top:${percent}%;' class='markHor'>`;
			}
			else if(mode.toHeadingValue == 270){
				currDirectMark = `<img src='static/img/markW.png' style='display: block;position: fixed;left:0;top:49%;' class='markHor'>`;
			}
			else if((mode.toHeadingValue>270)&&(mode.toHeadingValue<315)){
				percent = (mode.toHeadingValue-227)*100/90;
				currDirectMark = `<img src='static/img/markWNW.png' style='display:block;position:fixed;left:0;bottom:${percent}%;' class='markHor'>`;
			}
			else if(mode.toHeadingValue==315){
				currDirectMark = `<img src='static/img/markNW.png' style='display: block;position: absolute;top:0;left:0;' class='markHor'>`;
			}
			// Метка текущего направления 	theHeading уже есть
			if((theHeading>315)&&(theHeading<=360)){
				percent = 100 - (theHeading - 315)*100/90;
				currTrackMark = `<img src='static/img/markCurrN.png' style='display:block;position:fixed;top:0;right:${percent}%;' class='vert'>`;
			} 
			else if((theHeading>=0)&&(theHeading<45)){
				percent = (theHeading+45)*100/90;
				currTrackMark = `<img src='static/img/markCurrN.png' style='display: block;position: fixed;top:0;left:${percent}%;' class='vert'>`;
			}
			else if(theHeading == 45){
				currTrackMark = `<img src='static/img/markCurrSE.png' style='display: block;position: fixed;top:0;right:0;' class='vert'>`;
			}
			else if((theHeading > 45) && (theHeading < 135)){
				percent = 100 - (theHeading-45)*100/90;
				currTrackMark = `<img src='static/img/markCurrE.png' style='display: block;position: fixed;right:0;bottom:${percent}%;' class='hor'>`;
			}
			else if(theHeading == 135){
				currTrackMark = `<img src='static/img/markCurrNE.png' style='display: block;position: fixed;bottom:0;right:0;' class='vert'>`;
			}
			else if((theHeading>135)&&(theHeading<225)){
				percent = 100 - (theHeading-135)*100/90;
				currTrackMark = `<img src='static/img/markCurrN.png' style='display: block;position: fixed;bottom:0;left:${percent}%;' class='vert'>`;
			}
			else if(theHeading==225){
				currTrackMark = `<img src='static/img/markCurrNE.png' style='display: block;position: fixed;bottom:0;left:0;' class='vert'>`;
			}
			else if((theHeading>225)&&(theHeading<315)){
				percent = 100 - (theHeading-225)*100/90;
				currTrackMark = `<img src='static/img/markCurrE.png' style='display:block;position:fixed;left:0;top:${percent}%;' class='hor'>`;
			}
			else if(theHeading==315){
				currTrackMark = `<img src='static/img/markCurrNE.png' style='display: block;position: absolute;top:0;left:0;' class='vert'>`;
			}
		}

		// DISPLAY:
		let fontZ = Math.floor(symbol.length/3); 	// считая, что штатный размер шрифта позволяет разместить 4 символа на экране
		if(fontZ>1) {
			fontZ = Math.round((1/fontZ)*100);
			symbol = "<span style='font-size:"+fontZ+"%;'>"+symbol+"</span>";
		}
		// Вся переменная mode является "сессией" и всегда сохраняется целиком
		uri = encodeURI(`http://${dashboardHost}:${dashboardPort}/?session=${inData.session}`);

		//app.debug("menu=",menu);
		let responseBody = `<!DOCTYPE html >
<html>
<head>
	<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
	<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
	<meta http-equiv="Pragma" content="no-cache" />
	<meta http-equiv="Expires" content="0" />
	<meta http-equiv="Content-Script-Type" content="text/javascript">
		`;
		if(!menu) responseBody += `<meta http-equiv='refresh' content="${options.refreshInterval}; url=${uri}" />`;
		responseBody += `
	<script src="static/dashboard.js">	</script>
		`;
		if(alarm) responseBody += "<script>"+alarmJS+"</script>";
		responseBody += `
	<link rel="stylesheet" href="static/dashboard.css" type="text/css"> 
   <title>e-inkDashboard ${versionTXT}</title>
</head>
<body style="margin:0; padding:0;">
${currTrackMark} ${currDirectMark}
<!--Refresh interval: ${options.refreshInterval};-->
<script>
var controlKeys = getCookie('e-inkDashboardControlKeys');
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
	width:75%;
	background-color:lightgrey;
	padding: 1rem;
	font-size: xx-large;
	z-index: 10;
'>
	<input type='hidden' name='session' value=${JSON.stringify(mode)}>
	<table>
		<tr style='height:2rem;'>
			<td><input type='checkbox' name='depthAlarm' value='1' 
			`;
			if(mode.depthAlarm) responseBody += 'checked';
			responseBody += ` style='height:3em;width:3rem;'
			></td><td>${dashboardDepthMenuTXT}, ${dashboardDepthMesTXT}</td><td style='width:10%;'><input type='text' name=minDepthValue value='${mode.minDepthValue?mode.minDepthValue:''}' style='width:95%;font-size:inherit;'></td>
		</tr><tr style='height:2rem;'>
			<td><input type='checkbox' name='minSpeedAlarm' value='1' 
			`;
			if(mode.minSpeedAlarm) responseBody += 'checked';
			responseBody += ` style='height:3em;width:3rem;'
			></td><td>${dashboardMinSpeedMenuTXT}, ${dashboardSpeedMesTXT}</td><td style='width:10%;'><input type='text' name=minSpeedValue value='${mode.minSpeedValue?mode.minSpeedValue:''}' style='width:95%;font-size:inherit;'></td>
		</tr><tr style='height:2rem;'>
			<td><input type='checkbox' name='maxSpeedAlarm' value='1'`;
			if(mode.maxSpeedAlarm) responseBody += 'checked';
			responseBody += ` style='height:3em;width:3rem;'
			></td><td>${dashboardMaxSpeedMenuTXT}, ${dashboardSpeedMesTXT}</td><td style='width:10%;'><input type='text' name=maxSpeedValue value='${mode.maxSpeedValue?mode.maxSpeedValue:''}' style='width:95%;font-size:inherit;'></td>
		</tr><tr style='height:2rem;'>
			<td><input type='checkbox' name='toHeadingAlarmCheck' value='1'`;
			if(mode.toHeadingAlarm) responseBody += 'checked';
			responseBody += ` style='height:3em;width:3rem;' ></td><td>`;
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
				else responseBody += tpv.magtrack == undefined?'':tpv.magtrack.value == null?'':Math.round(tpv.magtrack.value);
			}
			else {
				if(mode.toHeadingAlarm) responseBody += mode.toHeadingValue;
				else responseBody += tpv.track == undefined?'':tpv.track.value == null?'':Math.round(tpv.track.value);
			}
			responseBody += `' style='width:95%;font-size:inherit;'></td>
		</tr><tr>
			<td></td><td style='padding-top:1rem;'><a href='${uri}' style='text-decoration:none;'><input type='button' value='&nbsp;&nbsp;&#x2718;&nbsp;&nbsp;' style='font-size:130%;'></a><input type='submit' name='submit' value='&nbsp;&nbsp;&#x2713;&nbsp;&nbsp;' style='font-size:130%;float:right;'></td><td></td>
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
		${MOBtxt}
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
				<span style='font-size:75%;'>${Math.round(tpv['magvar'].value)}</span> `;	
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
//document.cookie = 'e-inkDashboardControlKeys='+encodeURIComponent(keyCodes)+'; expires='+date+';';
document.cookie = 'e-inkDashboardControlKeys='+keyCodes+'; expires='+date+';';
setKeysWin.style.display = 'none';
} // end function saveKeys

jsTest();
</script>`;
		}
		responseBody += `
</body>
</html>`;
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
		app.setPluginStatus(`Normal run, open dashboard at http://${dashboardHost}:${dashboardPort}/`);
	});
	unsubscribes.push(() => { 	// функция остановки сервера при остановке плугина
		server.close();
		app.debug('Dashboard server stopped');
	})



	function bearing(latlng1, latlng2) {
	/* азимут направления между двумя точками в градусах */
	//console.log('[bearing] input','latlng1',latlng1,'latlng2',latlng2);
	const rad = Math.PI/180;
	let lat1,lat2,lon1,lon2;
	if(Array.isArray(latlng1)){
		lat1 = latlng1[1] * rad;
		lon1 = latlng1[0] * rad;
	}
	else{
		lat1 = latlng1.lat * rad;
		lon1 = latlng1.lng * rad;
	}
	if(Array.isArray(latlng2)){
		lat2 = latlng2[1] * rad;
		lon2 = latlng2[0] * rad;
	}
	else{
		lat2 = latlng2.lat * rad;
		lon2 = latlng2.lng * rad;
	}
	//app.debug('lat1=',lat1,'lat2=',lat2,'lon1=',lon1,'lon2=',lon2);

	let y = Math.sin(lon2 - lon1) * Math.cos(lat2);
	let x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
	//console.log('x',x,'y',y)

	let bearing = ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
	if(bearing >= 360) bearing = bearing-360;

	return bearing;
	} // end function bearing
	
	function setSKzones(path,zones,alarmMethod=["sound", "visual"]){
	// Чисто потому что запись очень громоздкая
	app.handleMessage(plugin.id, {
		context: 'vessels.self',
		updates: [
			{
				source: { label: plugin.id },
				timestamp: new Date().toISOString(),
				meta: [
					{
						path: path,
						value: {
							alarmMethod: alarmMethod,
							zones : zones
						}
					}
				],
			}
		]
	});
	} // end function setSKzones
	
	function setSKnotification(path,value){
	// Чисто потому что запись очень громоздкая
	app.handleMessage(plugin.id, {
		context: 'vessels.self',
		updates: [
			{
				source: { label: plugin.id },
				timestamp: new Date().toISOString(),
				values: [
					{
						path: 'notifications.'+path,
						value: value
					}
				],
			}
		]
	});			
	} // end function setSKnotification
	
}; // end function plugin.start

plugin.stop = function () {
// Here we put logic we need when the plugin stops
	app.debug('Plugin stopped');
	unsubscribes.forEach(f => f());
	unsubscribes = [];
}; // end function plugin.stop

return plugin;
}; //end module.exports








