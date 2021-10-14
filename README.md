# e-ink Dashboard for Signal K [![License: CC BY-SA 4.0](https://img.shields.io/badge/License-CC%20BY--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-sa/4.0/)

## v. 0.1
The e-inkDashboard displaying some instruments, attached to Signal K on weak (and/or old) devices, such as e-ink readers.  
Only browser needed. No fanciful javascript, no fanciful css.  

## Features

* velocity
* depth
* true or magnetic course
* alarms

 ![Dashboard velocity](screenshots/db1.jpg)<br>
 ![Dashboard depth](screenshots/db2.jpg)<br>
At the border of the screen is always visible the mark with general direction.

## Compatibility
Linux. Signal K.

## Usage
The screen image optimized to different screen resolutions and should look good from little to big screens.  
The presence of the touch screen is assumed, and mode is switched by a tap to the next data type button on the screen.   You can use two or more devices to display different info.  
For some devices with JavaScript you may set up some hardware keys to switch mode, magnetic or true course and opening alarm menu. Use <img src="static/img/settings.png" alt="Settings button" width="24px"> button on bottom of alarm menu to set up it. Default keys is:

* ArrowDown for next mode
* ArrowUp for previous mode
* AltRight for alarm menu
* KeyM for magnetic course switch
 
Access to the e-inkDashboard by address:   

`http://YourSignalKhost:YourSignalKport/e-inkdashboard/`  

 The e-inkDashboard allows you to set a visual and sound signal for dangerous events, such as shallow or speed.
 ![Dashboard alarms](screenshots/db3.jpg)<br>
Set up your browser to allow sound signal.  
The signal settings are local for every showing device, and it is triggered only if the device work. Be careful!

## Install&configure:
Install plugin from Signal K Appstore as **e-inkdashboard**.  
Restart Signal K,  
Use Server -> Plugin Config menu to start plugin and configure port and update frequency.  
Set update frequency to comfort rate for your device. Note that too quick update make difficult a mode change, but to slow update is dangerous of not noticing a rapidly changing parameter such as depth.  
Press Submit to save changes.

## Thanks

* [Typicons by Stephen Hutchings](https://icon-icons.com/pack/Typicons/1144) for icons.
* [ryanflorence](https://gist.github.com/ryanflorence/701407) for ideas.

## Support

[Discussions](https://github.com/VladimirKalachikhin/e-inkDashboard/discussions)

You can get support for GaladrielMap and GaladrielCahe for a beer [via PayPal](https://paypal.me/VladimirKalachikhin) or [YandexMoney](https://yasobe.ru/na/galadrielmap) at [galadrielmap@gmail.com](mailto:galadrielmap@gmail.com)  
