/*!
 * reveal.js
 * http://lab.hakim.se/reveal-js
 * MIT licensed
 *
 * Copyright (C) 2013 Hakim El Hattab, http://hakim.se
 */
var Reveal = (function(){

	'use strict';

	var SLIDES_SELECTOR = '.reveal .slides section',
		HORIZONTAL_SLIDES_SELECTOR = '.reveal .slides>section',
		VERTICAL_SLIDES_SELECTOR = '.reveal .slides>section.present>section',
		HOME_SLIDE_SELECTOR = '.reveal .slides>section:first-child',

		// Configurations defaults, can be overridden at initialization time
		config = {

			// The "normal" size of the presentation, aspect ratio will be preserved
			// when the presentation is scaled to fit different resolutions
			width: 1920,
			height: 1080,

			// Factor of the display size that should remain empty around the content
			margin: 0.1,

			// Bounds for smallest/largest possible scale to apply to content
			minScale: 0.2,
			maxScale: 1.0,

			// Display controls in the bottom right corner
			controls: true,

			// Display a presentation progress bar
			progress: true,

			// Push each slide change to the browser history
			history: false,

			// Enable keyboard shortcuts for navigation
			keyboard: true,

			// Enable the slide overview mode
			overview: true,

			// Vertical centring of slides
			center: true,

			// Enables touch navigation on devices with touch input
			touch: true,

			// Loop the presentation
			loop: true,

			// Change the presentation direction to be RTL
			rtl: false,

			// Number of milliseconds between automatically proceeding to the
			// next slide, disabled when set to 0, this value can be overwritten
			// by using a data-autoslide attribute on your slides
			autoSlide: 0,

			// Enable slide navigation via mouse wheel
			mouseWheel: false,

			// Apply a 3D roll to links on hover
			rollingLinks: true,

			// Theme (see /css/theme)
			theme: null,

			// Transition style
			transition: 'default', // default/cube/page/concave/zoom/linear/fade/none

			// Script dependencies to load
			dependencies: []
		},

		// Stores if the next slide should be shown automatically
		// after n milliseconds
		autoSlide = config.autoSlide,

		// The horizontal and vertical index of the currently active slide
		indexh = 0,
		indexv = 0,

		// The previous and current slide HTML elements
		previousSlide,
		currentSlide,

		// Slides may hold a data-state attribute which we pick up and apply
		// as a class to the body. This list contains the combined state of
		// all current slides.
		state = [],

		// The current scale of the presentation (see width/height config)
		scale = 1,

		// Cached references to DOM elements
		dom = {},

		// Detect support for CSS 3D transforms
		supports3DTransforms =  'WebkitPerspective' in document.body.style ||
								'MozPerspective' in document.body.style ||
								'msPerspective' in document.body.style ||
								'OPerspective' in document.body.style ||
								'perspective' in document.body.style,

		// Detect support for CSS 2D transforms
		supports2DTransforms =  'WebkitTransform' in document.body.style ||
								'MozTransform' in document.body.style ||
								'msTransform' in document.body.style ||
								'OTransform' in document.body.style ||
								'transform' in document.body.style,

		// Throttles mouse wheel navigation
		mouseWheelTimeout = 0,

		// An interval used to automatically move on to the next slide
		autoSlideTimeout = 0,

		// Delays updates to the URL due to a Chrome thumbnailer bug
		writeURLTimeout = 0,

		// A delay used to activate the overview mode
		activateOverviewTimeout = 0,

		// A delay used to deactivate the overview mode
		deactivateOverviewTimeout = 0,

		// Flags if the interaction event listeners are bound
		eventsAreBound = false,

		// Holds information about the currently ongoing touch input
		touch = {
			startX: 0,
			startY: 0,
			startSpan: 0,
			startCount: 0,
			handled: false,
			threshold: 80
		};

	/**
	 * Starts up the presentation if the client is capable.
	 */
	function initialize( options ) {

		if( !supports2DTransforms && !supports3DTransforms ) {
			document.body.setAttribute( 'class', 'no-transforms' );

			// If the browser doesn't support core features we won't be
			// using JavaScript to control the presentation
			return;
		}

		// Force a layout when the whole page, incl fonts, has loaded
		window.addEventListener( 'load', layout, false );

		// Copy options over to our config object
		extend( config, options );

		// Hide the address bar in mobile browsers
		hideAddressBar();

		// Loads the dependencies and continues to #start() once done
		load();

	}

	/**
	 * Finds and stores references to DOM elements which are
	 * required by the presentation. If a required element is
	 * not found, it is created.
	 */
	function setupDOM() {

		// Cache references to key DOM elements
		dom.theme = document.querySelector( '#theme' );
		dom.wrapper = document.querySelector( '.reveal' );
		dom.slides = document.querySelector( '.reveal .slides' );

		// Progress bar
		if( !dom.wrapper.querySelector( '.progress' ) && config.progress ) {
			var progressElement = document.createElement( 'div' );
			progressElement.classList.add( 'progress' );
			progressElement.innerHTML = '<span></span>';
			dom.wrapper.appendChild( progressElement );
		}

		// Arrow controls
		if( !dom.wrapper.querySelector( '.controls' ) && config.controls ) {
			var controlsElement = document.createElement( 'aside' );
			controlsElement.classList.add( 'controls' );
			controlsElement.innerHTML = '<div class="navigate-left"></div>' +
										'<div class="navigate-right"></div>' +
										'<div class="navigate-up"></div>' +
										'<div class="navigate-down"></div>';
			dom.wrapper.appendChild( controlsElement );
		}

		// Presentation background element
		if( !dom.wrapper.querySelector( '.state-background' ) ) {
			var backgroundElement = document.createElement( 'div' );
			backgroundElement.classList.add( 'state-background' );
			dom.wrapper.appendChild( backgroundElement );
		}

		// Overlay graphic which is displayed during the paused mode
		if( !dom.wrapper.querySelector( '.pause-overlay' ) ) {
			var pausedElement = document.createElement( 'div' );
			pausedElement.classList.add( 'pause-overlay' );
			dom.wrapper.appendChild( pausedElement );
		}

		// Cache references to elements
		dom.progress = document.querySelector( '.reveal .progress' );
		dom.progressbar = document.querySelector( '.reveal .progress span' );

		if ( config.controls ) {
			dom.controls = document.querySelector( '.reveal .controls' );

			// There can be multiple instances of controls throughout the page
			dom.controlsLeft = toArray( document.querySelectorAll( '.navigate-left' ) );
			dom.controlsRight = toArray( document.querySelectorAll( '.navigate-right' ) );
			dom.controlsUp = toArray( document.querySelectorAll( '.navigate-up' ) );
			dom.controlsDown = toArray( document.querySelectorAll( '.navigate-down' ) );
			dom.controlsPrev = toArray( document.querySelectorAll( '.navigate-prev' ) );
			dom.controlsNext = toArray( document.querySelectorAll( '.navigate-next' ) );
		}

	}

	/**
	 * Hides the address bar if we're on a mobile device.
	 */
	function hideAddressBar() {

		if( /iphone|ipod|android/gi.test( navigator.userAgent ) && !/crios/gi.test( navigator.userAgent ) ) {
			// Events that should trigger the address bar to hide
			window.addEventListener( 'load', removeAddressBar, false );
			window.addEventListener( 'orientationchange', removeAddressBar, false );
		}

	}

	/**
	 * Loads the dependencies of reveal.js. Dependencies are
	 * defined via the configuration option 'dependencies'
	 * and will be loaded prior to starting/binding reveal.js.
	 * Some dependencies may have an 'async' flag, if so they
	 * will load after reveal.js has been started up.
	 */
	function load() {

		var scripts = [],
			scriptsAsync = [];

		for( var i = 0, len = config.dependencies.length; i < len; i++ ) {
			var s = config.dependencies[i];

			// Load if there's no condition or the condition is truthy
			if( !s.condition || s.condition() ) {
				if( s.async ) {
					scriptsAsync.push( s.src );
				}
				else {
					scripts.push( s.src );
				}

				// Extension may contain callback functions
				if( typeof s.callback === 'function' ) {
					head.ready( s.src.match( /([\w\d_\-]*)\.?js$|[^\\\/]*$/i )[0], s.callback );
				}
			}
		}

		// Called once synchronous scripts finish loading
		function proceed() {
			if( scriptsAsync.length ) {
				// Load asynchronous scripts
				head.js.apply( null, scriptsAsync );
			}

			start();
		}

		if( scripts.length ) {
			head.ready( proceed );

			// Load synchronous scripts
			head.js.apply( null, scripts );
		}
		else {
			proceed();
		}

	}

	/**
	 * Starts up reveal.js by binding input events and navigating
	 * to the current URL deeplink if there is one.
	 */
	function start() {

		// Make sure we've got all the DOM elements we need
		setupDOM();

		// Subscribe to input
		addEventListeners();

		// Updates the presentation to match the current configuration values
		configure();

		// Read the initial hash
		readURL();

		// Start auto-sliding if it's enabled
		cueAutoSlide();

		// Notify listeners that the presentation is ready but use a 1ms
		// timeout to ensure it's not fired synchronously after #initialize()
		setTimeout( function() {
			dispatchEvent( 'ready', {
				'indexh': indexh,
				'indexv': indexv,
				'currentSlide': currentSlide
			} );
		}, 1 );

	}

	/**
	 * Applies the configuration settings from the config object.
	 */
	function configure( options ) {

		dom.wrapper.classList.remove( config.transition );

		// New config options may be passed when this method
		// is invoked through the API after initialization
		if( typeof options === 'object' ) extend( config, options );

		// Force linear transition based on browser capabilities
		if( supports3DTransforms === false ) config.transition = 'linear';

		dom.wrapper.classList.add( config.transition );

		if( dom.controls ) {
			dom.controls.style.display = ( config.controls && dom.controls ) ? 'block' : 'none';
		}

		if( dom.progress ) {
			dom.progress.style.display = ( config.progress && dom.progress ) ? 'block' : 'none';
		}

		if( config.rtl ) {
			dom.wrapper.classList.add( 'rtl' );
		}
		else {
			dom.wrapper.classList.remove( 'rtl' );
		}

		if( config.center ) {
			dom.wrapper.classList.add( 'center' );
		}
		else {
			dom.wrapper.classList.remove( 'center' );
		}

		if( config.mouseWheel ) {
			document.addEventListener( 'DOMMouseScroll', onDocumentMouseScroll, false ); // FF
			document.addEventListener( 'mousewheel', onDocumentMouseScroll, false );
		}
		else {
			document.removeEventListener( 'DOMMouseScroll', onDocumentMouseScroll, false ); // FF
			document.removeEventListener( 'mousewheel', onDocumentMouseScroll, false );
		}

		// 3D links
		if( config.rollingLinks ) {
			enable3DLinks();
		}
		else {
			disable3DLinks();
		}

		// Load the theme in the config, if it's not already loaded
		if( config.theme && dom.theme ) {
			var themeURL = dom.theme.getAttribute( 'href' );
			var themeFinder = /[^\/]*?(?=\.css)/;
			var themeName = themeURL.match(themeFinder)[0];

			if(  config.theme !== themeName ) {
				themeURL = themeURL.replace(themeFinder, config.theme);
				dom.theme.setAttribute( 'href', themeURL );
			}
		}

		// Force a layout to make sure the current config is accounted for
		layout();

	}

	/**
	 * Binds all event listeners.
	 */
	function addEventListeners() {

		eventsAreBound = true;

		window.addEventListener( 'hashchange', onWindowHashChange, false );
		window.addEventListener( 'resize', onWindowResize, false );

		if( config.touch ) {
			document.addEventListener( 'touchstart', onDocumentTouchStart, false );
			document.addEventListener( 'touchmove', onDocumentTouchMove, false );
			document.addEventListener( 'touchend', onDocumentTouchEnd, false );
		}

		if( config.keyboard ) {
			document.addEventListener( 'keydown', onDocumentKeyDown, false );
		}

		if ( config.progress && dom.progress ) {
			dom.progress.addEventListener( 'click', onProgressClicked, false );
		}

		if ( config.controls && dom.controls ) {
			var actionEvent = 'ontouchstart' in window && window.ontouchstart != null ? 'touchstart' : 'click';
			dom.controlsLeft.forEach( function( el ) { el.addEventListener( actionEvent, onNavigateLeftClicked, false ); } );
			dom.controlsRight.forEach( function( el ) { el.addEventListener( actionEvent, onNavigateRightClicked, false ); } );
			dom.controlsUp.forEach( function( el ) { el.addEventListener( actionEvent, onNavigateUpClicked, false ); } );
			dom.controlsDown.forEach( function( el ) { el.addEventListener( actionEvent, onNavigateDownClicked, false ); } );
			dom.controlsPrev.forEach( function( el ) { el.addEventListener( actionEvent, onNavigatePrevClicked, false ); } );
			dom.controlsNext.forEach( function( el ) { el.addEventListener( actionEvent, onNavigateNextClicked, false ); } );
		}

	}

	/**
	 * Unbinds all event listeners.
	 */
	function removeEventListeners() {

		eventsAreBound = false;

		document.removeEventListener( 'keydown', onDocumentKeyDown, false );
		window.removeEventListener( 'hashchange', onWindowHashChange, false );
		window.removeEventListener( 'resize', onWindowResize, false );

		if( config.touch ) {
			document.removeEventListener( 'touchstart', onDocumentTouchStart, false );
			document.removeEventListener( 'touchmove', onDocumentTouchMove, false );
			document.removeEventListener( 'touchend', onDocumentTouchEnd, false );
		}

		if ( config.progress && dom.progress ) {
			dom.progress.removeEventListener( 'click', onProgressClicked, false );
		}

		if ( config.controls && dom.controls ) {
			var actionEvent = 'ontouchstart' in window && window.ontouchstart != null ? 'touchstart' : 'click';
			dom.controlsLeft.forEach( function( el ) { el.removeEventListener( actionEvent, onNavigateLeftClicked, false ); } );
			dom.controlsRight.forEach( function( el ) { el.removeEventListener( actionEvent, onNavigateRightClicked, false ); } );
			dom.controlsUp.forEach( function( el ) { el.removeEventListener( actionEvent, onNavigateUpClicked, false ); } );
			dom.controlsDown.forEach( function( el ) { el.removeEventListener( actionEvent, onNavigateDownClicked, false ); } );
			dom.controlsPrev.forEach( function( el ) { el.removeEventListener( actionEvent, onNavigatePrevClicked, false ); } );
			dom.controlsNext.forEach( function( el ) { el.removeEventListener( actionEvent, onNavigateNextClicked, false ); } );
		}

	}

	/**
	 * Extend object a with the properties of object b.
	 * If there's a conflict, object b takes precedence.
	 */
	function extend( a, b ) {

		for( var i in b ) {
			a[ i ] = b[ i ];
		}

	}

	/**
	 * Converts the target object to an array.
	 */
	function toArray( o ) {

		return Array.prototype.slice.call( o );

	}

	/**
	 * Measures the distance in pixels between point a
	 * and point b.
	 *
	 * @param {Object} a point with x/y properties
	 * @param {Object} b point with x/y properties
	 */
	function distanceBetween( a, b ) {

		var dx = a.x - b.x,
			dy = a.y - b.y;

		return Math.sqrt( dx*dx + dy*dy );

	}

	/**
	 * Causes the address bar to hide on mobile devices,
	 * more vertical space ftw.
	 */
	function removeAddressBar() {

		if( window.orientation === 0 ) {
			document.documentElement.style.overflow = 'scroll';
			document.body.style.height = '120%';
		}
		else {
			document.documentElement.style.overflow = '';
			document.body.style.height = '100%';
		}

		setTimeout( function() {
			window.scrollTo( 0, 1 );
		}, 10 );

	}

	/**
	 * Dispatches an event of the specified type from the
	 * reveal DOM element.
	 */
	function dispatchEvent( type, properties ) {

		var event = document.createEvent( "HTMLEvents", 1, 2 );
		event.initEvent( type, true, true );
		extend( event, properties );
		dom.wrapper.dispatchEvent( event );

	}

	/**
	 * Wrap all links in 3D goodness.
	 */
	function enable3DLinks() {

		if( supports3DTransforms && !( 'msPerspective' in document.body.style ) ) {
			var anchors = document.querySelectorAll( SLIDES_SELECTOR + ' a:not(.image)' );

			for( var i = 0, len = anchors.length; i < len; i++ ) {
				var anchor = anchors[i];

				if( anchor.textContent && !anchor.querySelector( '*' ) && ( !anchor.className || !anchor.classList.contains( anchor, 'roll' ) ) ) {
					var span = document.createElement('span');
					span.setAttribute('data-title', anchor.text);
					span.innerHTML = anchor.innerHTML;

					anchor.classList.add( 'roll' );
					anchor.innerHTML = '';
					anchor.appendChild(span);
				}
			}
		}

	}

	/**
	 * Unwrap all 3D links.
	 */
	function disable3DLinks() {

		var anchors = document.querySelectorAll( SLIDES_SELECTOR + ' a.roll' );

		for( var i = 0, len = anchors.length; i < len; i++ ) {
			var anchor = anchors[i];
			var span = anchor.querySelector( 'span' );

			if( span ) {
				anchor.classList.remove( 'roll' );
				anchor.innerHTML = span.innerHTML;
			}
		}

	}

	/**
	 * Return a sorted fragments list, ordered by an increasing
	 * "data-fragment-index" attribute.
	 *
	 * Fragments will be revealed in the order that they are returned by
	 * this function, so you can use the index attributes to control the 
	 * order of fragment appearance.
	 *
	 * To maintain a sensible default fragment order, fragments are presumed
	 * to be passed in document order. This function adds a "fragment-index"
	 * attribute to each node if such an attribute is not already present,
	 * and sets that attribute to an integer value which is the position of
	 * the fragment within the fragments list.
	 */
	function sortFragments( fragments ) {

		var a = toArray( fragments );

		a.forEach( function( el, idx ) {
			if( !el.hasAttribute( 'data-fragment-index' ) ) {
				el.setAttribute( 'data-fragment-index', idx );
			}
		} );

		a.sort( function( l, r ) {
			return l.getAttribute( 'data-fragment-index' ) - r.getAttribute( 'data-fragment-index');
		} );

		return a

	}

	/**
	 * Applies JavaScript-controlled layout rules to the
	 * presentation.
	 */
	function layout() {

		if( dom.wrapper ) {

			// Available space to scale within
			var availableWidth = dom.wrapper.offsetWidth,
				availableHeight = dom.wrapper.offsetHeight;

			// Reduce available space by margin
			availableWidth -= ( availableHeight * config.margin );
			availableHeight -= ( availableHeight * config.margin );

			// Dimensions of the content
			var slideWidth = config.width,
				slideHeight = config.height;

			// Slide width may be a percentage of available width
			if( typeof slideWidth === 'string' && /%$/.test( slideWidth ) ) {
				slideWidth = parseInt( slideWidth, 10 ) / 100 * availableWidth;
			}

			// Slide height may be a percentage of available height
			if( typeof slideHeight === 'string' && /%$/.test( slideHeight ) ) {
				slideHeight = parseInt( slideHeight, 10 ) / 100 * availableHeight;
			}

			dom.slides.style.width = slideWidth + 'px';
			dom.slides.style.height = slideHeight + 'px';

			// Determine scale of content to fit within available space
			scale = Math.min( availableWidth / slideWidth, availableHeight / slideHeight );

			// Respect max/min scale settings
			scale = Math.max( scale, config.minScale );
			scale = Math.min( scale, config.maxScale );

			// Prefer applying scale via zoom since Chrome blurs scaled content
			// with nested transforms
			if( typeof dom.slides.style.zoom !== 'undefined' && !navigator.userAgent.match( /(iphone|ipod|ipad|android)/gi ) ) {
				dom.slides.style.zoom = scale;
			}
			// Apply scale transform as a fallback
			else {
				var transform = 'translate(-50%, -50%) scale('+ scale +') translate(50%, 50%)';

				dom.slides.style.WebkitTransform = transform;
				dom.slides.style.MozTransform = transform;
				dom.slides.style.msTransform = transform;
				dom.slides.style.OTransform = transform;
				dom.slides.style.transform = transform;
			}

			// Select all slides, vertical and horizontal
			var slides = toArray( document.querySelectorAll( SLIDES_SELECTOR ) );

			for( var i = 0, len = slides.length; i < len; i++ ) {
				var slide = slides[ i ];

				// Don't bother updating invisible slides
				if( slide.style.display === 'none' ) {
					continue;
				}

				if( config.center ) {
					// Vertical stacks are not centred since their section
					// children will be
					if( slide.classList.contains( 'stack' ) ) {
						slide.style.top = 0;
					}
					else {
						slide.style.top = Math.max( - ( slide.offsetHeight / 2 ) - 20, -slideHeight / 2 ) + 'px';
					}
				}
				else {
					slide.style.top = '';
				}

			}

		}

	}

	/**
	 * Stores the vertical index of a stack so that the same
	 * vertical slide can be selected when navigating to and
	 * from the stack.
	 *
	 * @param {HTMLElement} stack The vertical stack element
	 * @param {int} v Index to memorize
	 */
	function setPreviousVerticalIndex( stack, v ) {

		if( stack ) {
			stack.setAttribute( 'data-previous-indexv', v || 0 );
		}

	}

	/**
	 * Retrieves the vertical index which was stored using
	 * #setPreviousVerticalIndex() or 0 if no previous index
	 * exists.
	 *
	 * @param {HTMLElement} stack The vertical stack element
	 */
	function getPreviousVerticalIndex( stack ) {

		if( stack && stack.classList.contains( 'stack' ) ) {
			return parseInt( stack.getAttribute( 'data-previous-indexv' ) || 0, 10 );
		}

		return 0;

	}

	/**
	 * Displays the overview of slides (quick nav) by
	 * scaling down and arranging all slide elements.
	 *
	 * Experimental feature, might be dropped if perf
	 * can't be improved.
	 */
	function activateOverview() {

		// Only proceed if enabled in config
		if( config.overview ) {

			// Don't auto-slide while in overview mode
			cancelAutoSlide();

			var wasActive = dom.wrapper.classList.contains( 'overview' );

			dom.wrapper.classList.add( 'overview' );
			dom.wrapper.classList.remove( 'exit-overview' );

			clearTimeout( activateOverviewTimeout );
			clearTimeout( deactivateOverviewTimeout );

			// Not the pretties solution, but need to let the overview
			// class apply first so that slides are measured accurately
			// before we can position them
			activateOverviewTimeout = setTimeout( function(){

				var horizontalSlides = document.querySelectorAll( HORIZONTAL_SLIDES_SELECTOR );

				for( var i = 0, len1 = horizontalSlides.length; i < len1; i++ ) {
					var hslide = horizontalSlides[i],
						htransform = 'translateZ(-2500px) translate(' + ( ( i - indexh ) * 105 ) + '%, 0%)';

					hslide.setAttribute( 'data-index-h', i );
					hslide.style.display = 'block';
					hslide.style.WebkitTransform = htransform;
					hslide.style.MozTransform = htransform;
					hslide.style.msTransform = htransform;
					hslide.style.OTransform = htransform;
					hslide.style.transform = htransform;

					if( hslide.classList.contains( 'stack' ) ) {

						var verticalSlides = hslide.querySelectorAll( 'section' );

						for( var j = 0, len2 = verticalSlides.length; j < len2; j++ ) {
							var verticalIndex = i === indexh ? indexv : getPreviousVerticalIndex( hslide );

							var vslide = verticalSlides[j],
								vtransform = 'translate(0%, ' + ( ( j - verticalIndex ) * 105 ) + '%)';

							vslide.setAttribute( 'data-index-h', i );
							vslide.setAttribute( 'data-index-v', j );
							vslide.style.display = 'block';
							vslide.style.WebkitTransform = vtransform;
							vslide.style.MozTransform = vtransform;
							vslide.style.msTransform = vtransform;
							vslide.style.OTransform = vtransform;
							vslide.style.transform = vtransform;

							// Navigate to this slide on click
							vslide.addEventListener( 'click', onOverviewSlideClicked, true );
						}

					}
					else {

						// Navigate to this slide on click
						hslide.addEventListener( 'click', onOverviewSlideClicked, true );

					}
				}

				layout();

				if( !wasActive ) {
					// Notify observers of the overview showing
					dispatchEvent( 'overviewshown', {
						'indexh': indexh,
						'indexv': indexv,
						'currentSlide': currentSlide
					} );
				}

			}, 10 );

		}

	}

	/**
	 * Exits the slide overview and enters the currently
	 * active slide.
	 */
	function deactivateOverview() {

		// Only proceed if enabled in config
		if( config.overview ) {

			clearTimeout( activateOverviewTimeout );
			clearTimeout( deactivateOverviewTimeout );

			dom.wrapper.classList.remove( 'overview' );

			// Temporarily add a class so that transitions can do different things
			// depending on whether they are exiting/entering overview, or just
			// moving from slide to slide
			dom.wrapper.classList.add( 'exit-overview' );

			deactivateOverviewTimeout = setTimeout( function () {
				dom.wrapper.classList.remove( 'exit-overview' );
			}, 10);

			// Select all slides
			var slides = toArray( document.querySelectorAll( SLIDES_SELECTOR ) );

			for( var i = 0, len = slides.length; i < len; i++ ) {
				var element = slides[i];

				element.style.display = '';

				// Resets all transforms to use the external styles
				element.style.WebkitTransform = '';
				element.style.MozTransform = '';
				element.style.msTransform = '';
				element.style.OTransform = '';
				element.style.transform = '';

				element.removeEventListener( 'click', onOverviewSlideClicked, true );
			}

			slide( indexh, indexv );

			cueAutoSlide();

			// Notify observers of the overview hiding
			dispatchEvent( 'overviewhidden', {
				'indexh': indexh,
				'indexv': indexv,
				'currentSlide': currentSlide
			} );

		}
	}

	/**
	 * Toggles the slide overview mode on and off.
	 *
	 * @param {Boolean} override Optional flag which overrides the
	 * toggle logic and forcibly sets the desired state. True means
	 * overview is open, false means it's closed.
	 */
	function toggleOverview( override ) {

		if( typeof override === 'boolean' ) {
			override ? activateOverview() : deactivateOverview();
		}
		else {
			isOverview() ? deactivateOverview() : activateOverview();
		}

	}

	/**
	 * Checks if the overview is currently active.
	 *
	 * @return {Boolean} true if the overview is active,
	 * false otherwise
	 */
	function isOverview() {

		return dom.wrapper.classList.contains( 'overview' );

	}

	/**
	 * Handling the fullscreen functionality via the fullscreen API
	 *
	 * @see http://fullscreen.spec.whatwg.org/
	 * @see https://developer.mozilla.org/en-US/docs/DOM/Using_fullscreen_mode
	 */
	function enterFullscreen() {

		var element = document.body;

		// Check which implementation is available
		var requestMethod = element.requestFullScreen ||
							element.webkitRequestFullScreen ||
							element.mozRequestFullScreen ||
							element.msRequestFullScreen;

		if( requestMethod ) {
			requestMethod.apply( element );
		}

	}

	/**
	 * Enters the paused mode which fades everything on screen to
	 * black.
	 */
	function pause() {

		var wasPaused = dom.wrapper.classList.contains( 'paused' );

		cancelAutoSlide();
		dom.wrapper.classList.add( 'paused' );

		if( wasPaused === false ) {
			dispatchEvent( 'paused' );
		}

	}

	/**
	 * Exits from the paused mode.
	 */
	function resume() {

		var wasPaused = dom.wrapper.classList.contains( 'paused' );

		cueAutoSlide();
		dom.wrapper.classList.remove( 'paused' );

		if( wasPaused ) {
			dispatchEvent( 'resumed' );
		}

	}

	/**
	 * Toggles the paused mode on and off.
	 */
	function togglePause() {

		if( isPaused() ) {
			resume();
		}
		else {
			pause();
		}

	}

	/**
	 * Checks if we are currently in the paused mode.
	 */
	function isPaused() {

		return dom.wrapper.classList.contains( 'paused' );

	}

	/**
	 * Steps from the current point in the presentation to the
	 * slide which matches the specified horizontal and vertical
	 * indices.
	 *
	 * @param {int} h Horizontal index of the target slide
	 * @param {int} v Vertical index of the target slide
	 * @param {int} f Optional index of a fragment within the
	 * target slide to activate
	 */
	function slide( h, v, f ) {

		// Remember where we were at before
		previousSlide = currentSlide;

		// Query all horizontal slides in the deck
		var horizontalSlides = document.querySelectorAll( HORIZONTAL_SLIDES_SELECTOR );

		// If no vertical index is specified and the upcoming slide is a
		// stack, resume at its previous vertical index
		if( v === undefined ) {
			v = getPreviousVerticalIndex( horizontalSlides[ h ] );
		}

		// If we were on a vertical stack, remember what vertical index
		// it was on so we can resume at the same position when returning
		if( previousSlide && previousSlide.parentNode && previousSlide.parentNode.classList.contains( 'stack' ) ) {
			setPreviousVerticalIndex( previousSlide.parentNode, indexv );
		}

		// Remember the state before this slide
		var stateBefore = state.concat();

		// Reset the state array
		state.length = 0;

		var indexhBefore = indexh,
			indexvBefore = indexv;

		// Activate and transition to the new slide
		indexh = updateSlides( HORIZONTAL_SLIDES_SELECTOR, h === undefined ? indexh : h );
		indexv = updateSlides( VERTICAL_SLIDES_SELECTOR, v === undefined ? indexv : v );

		layout();

		// Apply the new state
		stateLoop: for( var i = 0, len = state.length; i < len; i++ ) {
			// Check if this state existed on the previous slide. If it
			// did, we will avoid adding it repeatedly
			for( var j = 0; j < stateBefore.length; j++ ) {
				if( stateBefore[j] === state[i] ) {
					stateBefore.splice( j, 1 );
					continue stateLoop;
				}
			}

			document.documentElement.classList.add( state[i] );

			// Dispatch custom event matching the state's name
			dispatchEvent( state[i] );
		}

		// Clean up the remains of the previous state
		while( stateBefore.length ) {
			document.documentElement.classList.remove( stateBefore.pop() );
		}

		// If the overview is active, re-activate it to update positions
		if( isOverview() ) {
			activateOverview();
		}

		// Update the URL hash after a delay since updating it mid-transition
		// is likely to cause visual lag
		writeURL( 1500 );

		// Find the current horizontal slide and any possible vertical slides
		// within it
		var currentHorizontalSlide = horizontalSlides[ indexh ],
			currentVerticalSlides = currentHorizontalSlide.querySelectorAll( 'section' );

		// Store references to the previous and current slides
		currentSlide = currentVerticalSlides[ indexv ] || currentHorizontalSlide;


		// Show fragment, if specified
		if( typeof f !== 'undefined' ) {
			var fragments = sortFragments( currentSlide.querySelectorAll( '.fragment' ) );

			toArray( fragments ).forEach( function( fragment, indexf ) {
				if( indexf < f ) {
					fragment.classList.add( 'visible' );
				}
				else {
					fragment.classList.remove( 'visible' );
				}
			} );
		}

		// Dispatch an event if the slide changed
		if( indexh !== indexhBefore || indexv !== indexvBefore ) {
			dispatchEvent( 'slidechanged', {
				'indexh': indexh,
				'indexv': indexv,
				'previousSlide': previousSlide,
				'currentSlide': currentSlide
			} );
		}
		else {
			// Ensure that the previous slide is never the same as the current
			previousSlide = null;
		}

		// Solves an edge case where the previous slide maintains the
		// 'present' class when navigating between adjacent vertical
		// stacks
		if( previousSlide ) {
			previousSlide.classList.remove( 'present' );

			// Reset all slides upon navigate to home
			// Issue: #285
			if ( document.querySelector( HOME_SLIDE_SELECTOR ).classList.contains( 'present' ) ) {
				// Launch async task
				setTimeout( function () {
					var slides = toArray( document.querySelectorAll( HORIZONTAL_SLIDES_SELECTOR + '.stack') ), i;
					for( i in slides ) {
						if( slides[i] ) {
							// Reset stack
							setPreviousVerticalIndex( slides[i], 0 );
						}
					}
				}, 0 );
			}
		}

		updateControls();
		updateProgress();

	}

	/**
	 * Updates one dimension of slides by showing the slide
	 * with the specified index.
	 *
	 * @param {String} selector A CSS selector that will fetch
	 * the group of slides we are working with
	 * @param {Number} index The index of the slide that should be
	 * shown
	 *
	 * @return {Number} The index of the slide that is now shown,
	 * might differ from the passed in index if it was out of
	 * bounds.
	 */
	function updateSlides( selector, index ) {

		// Select all slides and convert the NodeList result to
		// an array
		var slides = toArray( document.querySelectorAll( selector ) ),
			slidesLength = slides.length;

		if( slidesLength ) {

			// Should the index loop?
			if( config.loop ) {
				index %= slidesLength;

				if( index < 0 ) {
					index = slidesLength + index;
				}
			}

			// Enforce max and minimum index bounds
			index = Math.max( Math.min( index, slidesLength - 1 ), 0 );

			for( var i = 0; i < slidesLength; i++ ) {
				var element = slides[i];

				// Optimization; hide all slides that are three or more steps
				// away from the present slide
				if( isOverview() === false ) {
					// The distance loops so that it measures 1 between the first
					// and last slides
					var distance = Math.abs( ( index - i ) % ( slidesLength - 3 ) ) || 0;

					element.style.display = distance > 3 ? 'none' : 'block';
				}

				slides[i].classList.remove( 'past' );
				slides[i].classList.remove( 'present' );
				slides[i].classList.remove( 'future' );

				if( i < index ) {
					// Any element previous to index is given the 'past' class
					slides[i].classList.add( 'past' );
				}
				else if( i > index ) {
					// Any element subsequent to index is given the 'future' class
					slides[i].classList.add( 'future' );
				}

				// If this element contains vertical slides
				if( element.querySelector( 'section' ) ) {
					slides[i].classList.add( 'stack' );
				}
			}

			// Mark the current slide as present
			slides[index].classList.add( 'present' );

			// If this slide has a state associated with it, add it
			// onto the current state of the deck
			var slideState = slides[index].getAttribute( 'data-state' );
			if( slideState ) {
				state = state.concat( slideState.split( ' ' ) );
			}

			// If this slide has a data-autoslide attribtue associated use this as
			// autoSlide value otherwise use the global configured time
			var slideAutoSlide = slides[index].getAttribute( 'data-autoslide' );
			if( slideAutoSlide ) {
				autoSlide = parseInt( slideAutoSlide, 10 );
			}
			else {
				autoSlide = config.autoSlide;
			}

		}
		else {
			// Since there are no slides we can't be anywhere beyond the
			// zeroth index
			index = 0;
		}

		return index;

	}

	/**
	 * Updates the progress bar to reflect the current slide.
	 */
	function updateProgress() {

		// Update progress if enabled
		if( config.progress && dom.progress ) {

			var horizontalSlides = toArray( document.querySelectorAll( HORIZONTAL_SLIDES_SELECTOR ) );

			// The number of past and total slides
			var totalCount = document.querySelectorAll( SLIDES_SELECTOR + ':not(.stack)' ).length;
			var pastCount = 0;

			// Step through all slides and count the past ones
			mainLoop: for( var i = 0; i < horizontalSlides.length; i++ ) {

				var horizontalSlide = horizontalSlides[i];
				var verticalSlides = toArray( horizontalSlide.querySelectorAll( 'section' ) );

				for( var j = 0; j < verticalSlides.length; j++ ) {

					// Stop as soon as we arrive at the present
					if( verticalSlides[j].classList.contains( 'present' ) ) {
						break mainLoop;
					}

					pastCount++;

				}

				// Stop as soon as we arrive at the present
				if( horizontalSlide.classList.contains( 'present' ) ) {
					break;
				}

				// Don't count the wrapping section for vertical slides
				if( horizontalSlide.classList.contains( 'stack' ) === false ) {
					pastCount++;
				}

			}

			dom.progressbar.style.width = ( pastCount / ( totalCount - 1 ) ) * window.innerWidth + 'px';

		}

	}

	/**
	 * Updates the state of all control/navigation arrows.
	 */
	function updateControls() {

		if ( config.controls && dom.controls ) {

			var routes = availableRoutes();

			// Remove the 'enabled' class from all directions
			dom.controlsLeft.concat( dom.controlsRight )
							.concat( dom.controlsUp )
							.concat( dom.controlsDown )
							.concat( dom.controlsPrev )
							.concat( dom.controlsNext ).forEach( function( node ) {
				node.classList.remove( 'enabled' );
			} );

			// Add the 'enabled' class to the available routes
			if( routes.left ) dom.controlsLeft.forEach( function( el ) { el.classList.add( 'enabled' );	} );
			if( routes.right ) dom.controlsRight.forEach( function( el ) { el.classList.add( 'enabled' ); } );
			if( routes.up ) dom.controlsUp.forEach( function( el ) { el.classList.add( 'enabled' );	} );
			if( routes.down ) dom.controlsDown.forEach( function( el ) { el.classList.add( 'enabled' ); } );

			// Prev/next buttons
			if( routes.left || routes.up ) dom.controlsPrev.forEach( function( el ) { el.classList.add( 'enabled' ); } );
			if( routes.right || routes.down ) dom.controlsNext.forEach( function( el ) { el.classList.add( 'enabled' ); } );

		}

	}

	/**
	 * Determine what available routes there are for navigation.
	 *
	 * @return {Object} containing four booleans: left/right/up/down
	 */
	function availableRoutes() {

		var horizontalSlides = document.querySelectorAll( HORIZONTAL_SLIDES_SELECTOR ),
			verticalSlides = document.querySelectorAll( VERTICAL_SLIDES_SELECTOR );

		return {
			left: indexh > 0,
			right: indexh < horizontalSlides.length - 1,
			up: indexv > 0,
			down: indexv < verticalSlides.length - 1
		};

	}

	/**
	 * Reads the current URL (hash) and navigates accordingly.
	 */
	function readURL() {

		var hash = window.location.hash;

		// Attempt to parse the hash as either an index or name
		var bits = hash.slice( 2 ).split( '/' ),
			name = hash.replace( /#|\//gi, '' );

		// If the first bit is invalid and there is a name we can
		// assume that this is a named link
		if( isNaN( parseInt( bits[0], 10 ) ) && name.length ) {
			// Find the slide with the specified name
			var element = document.querySelector( '#' + name );

			if( element ) {
				// Find the position of the named slide and navigate to it
				var indices = Reveal.getIndices( element );
				slide( indices.h, indices.v );
			}
			// If the slide doesn't exist, navigate to the current slide
			else {
				slide( indexh, indexv );
			}
		}
		else {
			// Read the index components of the hash
			var h = parseInt( bits[0], 10 ) || 0,
				v = parseInt( bits[1], 10 ) || 0;

			slide( h, v );
		}

	}

	/**
	 * Updates the page URL (hash) to reflect the current
	 * state.
	 *
	 * @param {Number} delay The time in ms to wait before
	 * writing the hash
	 */
	function writeURL( delay ) {

		if( config.history ) {

			// Make sure there's never more than one timeout running
			clearTimeout( writeURLTimeout );

			// If a delay is specified, timeout this call
			if( typeof delay === 'number' ) {
				writeURLTimeout = setTimeout( writeURL, delay );
			}
			else {
				var url = '/';

				// If the current slide has an ID, use that as a named link
				if( currentSlide && typeof currentSlide.getAttribute( 'id' ) === 'string' ) {
					url = '/' + currentSlide.getAttribute( 'id' );
				}
				// Otherwise use the /h/v index
				else {
					if( indexh > 0 || indexv > 0 ) url += indexh;
					if( indexv > 0 ) url += '/' + indexv;
				}

				window.location.hash = url;
			}
		}

	}

	/**
	 * Retrieves the h/v location of the current, or specified,
	 * slide.
	 *
	 * @param {HTMLElement} slide If specified, the returned
	 * index will be for this slide rather than the currently
	 * active one
	 *
	 * @return {Object} { h: <int>, v: <int> }
	 */
	function getIndices( slide ) {

		// By default, return the current indices
		var h = indexh,
			v = indexv;

		// If a slide is specified, return the indices of that slide
		if( slide ) {
			var isVertical = !!slide.parentNode.nodeName.match( /section/gi );
			var slideh = isVertical ? slide.parentNode : slide;

			// Select all horizontal slides
			var horizontalSlides = toArray( document.querySelectorAll( HORIZONTAL_SLIDES_SELECTOR ) );

			// Now that we know which the horizontal slide is, get its index
			h = Math.max( horizontalSlides.indexOf( slideh ), 0 );

			// If this is a vertical slide, grab the vertical index
			if( isVertical ) {
				v = Math.max( toArray( slide.parentNode.querySelectorAll( 'section' ) ).indexOf( slide ), 0 );
			}
		}

		return { h: h, v: v };

	}

	/**
	 * Navigate to the next slide fragment.
	 *
	 * @return {Boolean} true if there was a next fragment,
	 * false otherwise
	 */
	function nextFragment() {

		// Vertical slides:
		if( document.querySelector( VERTICAL_SLIDES_SELECTOR + '.present' ) ) {
			var verticalFragments = sortFragments( document.querySelectorAll( VERTICAL_SLIDES_SELECTOR + '.present .fragment:not(.visible)' ) );

			if( verticalFragments.length ) {
				verticalFragments[0].classList.add( 'visible' );

				// Notify subscribers of the change
				dispatchEvent( 'fragmentshown', { fragment: verticalFragments[0] } );
				return true;
			}
		}
		// Horizontal slides:
		else {
			var horizontalFragments = sortFragments( document.querySelectorAll( HORIZONTAL_SLIDES_SELECTOR + '.present .fragment:not(.visible)' ) );

			if( horizontalFragments.length ) {
				horizontalFragments[0].classList.add( 'visible' );

				// Notify subscribers of the change
				dispatchEvent( 'fragmentshown', { fragment: horizontalFragments[0] } );
				return true;
			}
		}

		return false;

	}

	/**
	 * Navigate to the previous slide fragment.
	 *
	 * @return {Boolean} true if there was a previous fragment,
	 * false otherwise
	 */
	function previousFragment() {

		// Vertical slides:
		if( document.querySelector( VERTICAL_SLIDES_SELECTOR + '.present' ) ) {
			var verticalFragments = sortFragments( document.querySelectorAll( VERTICAL_SLIDES_SELECTOR + '.present .fragment.visible' ) );

			if( verticalFragments.length ) {
				verticalFragments[ verticalFragments.length - 1 ].classList.remove( 'visible' );

				// Notify subscribers of the change
				dispatchEvent( 'fragmenthidden', { fragment: verticalFragments[ verticalFragments.length - 1 ] } );
				return true;
			}
		}
		// Horizontal slides:
		else {
			var horizontalFragments = sortFragments( document.querySelectorAll( HORIZONTAL_SLIDES_SELECTOR + '.present .fragment.visible' ) );

			if( horizontalFragments.length ) {
				horizontalFragments[ horizontalFragments.length - 1 ].classList.remove( 'visible' );

				// Notify subscribers of the change
				dispatchEvent( 'fragmenthidden', { fragment: horizontalFragments[ horizontalFragments.length - 1 ] } );
				return true;
			}
		}

		return false;

	}

	/**
	 * Cues a new automated slide if enabled in the config.
	 */
	function cueAutoSlide() {

		clearTimeout( autoSlideTimeout );

		// Cue the next auto-slide if enabled
		if( autoSlide && !isPaused() && !isOverview() ) {
			autoSlideTimeout = setTimeout( navigateNext, autoSlide );
		}

	}

	/**
	 * Cancels any ongoing request to auto-slide.
	 */
	function cancelAutoSlide() {

		clearTimeout( autoSlideTimeout );

	}

	function navigateLeft() {

		// Prioritize hiding fragments
		if( availableRoutes().left && isOverview() || previousFragment() === false ) {
			slide( indexh - 1 );
		}

	}

	function navigateRight() {

		// Prioritize revealing fragments
		if( availableRoutes().right && isOverview() || nextFragment() === false ) {
			slide( indexh + 1 );
		}

	}

	function navigateUp() {

		// Prioritize hiding fragments
		if( availableRoutes().up && isOverview() || previousFragment() === false ) {
			slide( indexh, indexv - 1 );
		}


	}


/* OLD NavigateDown Function 

*/

function navigateDown() {

	// Prioritize revealing fragments
	if( availableRoutes().down && isOverview() || nextFragment() === false ) {
		slide( indexh, indexv + 1 );
	}

}


/* Old Code from Kendra's Love Hours

	function navigateDown() {

		// Prioritize revealing fragments
		if( availableRoutes().down && isOverview() || nextFragment() === false ) {
			slide( indexh, indexv + 1 );
			
			(function myLoop (i) {          
  			 setTimeout(function () {   
      		slide( indexh, indexv + 1 );       //  your code here                
      		if (--i) myLoop(i); //  decrement i and call myLoop again if i > 0
			if (i == 0) 
			{
				//	alert("done"); // uncomment this line for pause after 1st run through
					(function myLoop2 (i) {          
		  			 setTimeout(function () {   
		      		slide( indexh, indexv - 1 );       //  your code here                
		      		if (--i) myLoop2(i);      //  decrement i and call myLoop again if i > 0
					if (i == 0) {setTimeout("location.reload(true);",200); }
		 			}, 40);// set speed
		       		//  your code here   
		            
					})(281);
				
			}
			
		
  			 }, 3500) // set speed
			})(280); 
		}
		

	}
*/



	/**
	 * Navigates backwards, prioritized in the following order:
	 * 1) Previous fragment
	 * 2) Previous vertical slide
	 * 3) Previous horizontal slide
	 */
	function navigatePrev() {

		// Prioritize revealing fragments
		if( previousFragment() === false ) {
			if( availableRoutes().up ) {
				navigateUp();
			}
			else {
				// Fetch the previous horizontal slide, if there is one
				var previousSlide = document.querySelector( HORIZONTAL_SLIDES_SELECTOR + '.past:nth-child(' + indexh + ')' );

				if( previousSlide ) {
					indexv = ( previousSlide.querySelectorAll( 'section' ).length + 1 ) || undefined;
					indexh --;
					slide();
				}
			}
		}

	}

	/**
	 * Same as #navigatePrev() but navigates forwards.
	 */
	function navigateNext() {

		// Prioritize revealing fragments
		if( nextFragment() === false ) {
			availableRoutes().down ? navigateDown() : navigateRight();
		}

		// If auto-sliding is enabled we need to cue up
		// another timeout
		cueAutoSlide();

	}


	// --------------------------------------------------------------------//
	// ----------------------------- EVENTS -------------------------------//
	// --------------------------------------------------------------------//


	/**
	 * Handler for the document level 'keydown' event.
	 *
	 * @param {Object} event
	 */
	function onDocumentKeyDown( event ) {

		// Check if there's a focused element that could be using
		// the keyboard
		var activeElement = document.activeElement;
		var hasFocus = !!( document.activeElement && ( document.activeElement.type || document.activeElement.href || document.activeElement.contentEditable !== 'inherit' ) );

		// Disregard the event if there's a focused element or a
		// keyboard modifier key is present
		if( hasFocus || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey ) return;

		var triggered = true;

		// while paused only allow "unpausing" keyboard events (b and .)
		if( isPaused() && [66,190,191].indexOf( event.keyCode ) === -1 ) {
			return false;
		}

		switch( event.keyCode ) {
			// p, page up
			case 80: case 33: navigatePrev(); break;
			// n, page down
			case 78: case 34: navigateNext(); break;
			// h, left
			case 72: case 37: navigateLeft(); break;
			// l, right
			case 76: case 39: navigateRight(); break;
			// k, up
			case 75: case 38: navigateUp(); break;
			// j, down -- comment out if you want to skip //
			case 74: case 40: navigateDown(); break;
			// home
			case 36: slide( 0 ); break;
			// end
			case 35: slide( Number.MAX_VALUE ); break;
			// space
//			case 32: isOverview() ? deactivateOverview() : navigateNext(); break;

 // space
			case 32: alert("Paused. Press return to unpause."); break;			
			// return
			case 13: isOverview() ? deactivateOverview() : triggered = false; break;
			// b, period, Logitech presenter tools "black screen" button
			case 66: case 190: case 191: togglePause(); break;
			// f
			case 70: enterFullscreen(); break;
			
			default:
				triggered = false;
		}

		// If the input resulted in a triggered action we should prevent
		// the browsers default behavior
		if( triggered ) {
			event.preventDefault();
		}
		else if ( event.keyCode === 27 && supports3DTransforms ) {
			toggleOverview();

			event.preventDefault();
		}

		// If auto-sliding is enabled we need to cue up
		// another timeout
		cueAutoSlide();

	}

	/**
	 * Handler for the document level 'touchstart' event,
	 * enables support for swipe and pinch gestures.
	 */
	function onDocumentTouchStart( event ) {

		touch.startX = event.touches[0].clientX;
		touch.startY = event.touches[0].clientY;
		touch.startCount = event.touches.length;

		// If there's two touches we need to memorize the distance
		// between those two points to detect pinching
		if( event.touches.length === 2 && config.overview ) {
			touch.startSpan = distanceBetween( {
				x: event.touches[1].clientX,
				y: event.touches[1].clientY
			}, {
				x: touch.startX,
				y: touch.startY
			} );
		}

	}

	/**
	 * Handler for the document level 'touchmove' event.
	 */
	function onDocumentTouchMove( event ) {

		// Each touch should only trigger one action
		if( !touch.handled ) {
			var currentX = event.touches[0].clientX;
			var currentY = event.touches[0].clientY;

			// If the touch started off with two points and still has
			// two active touches; test for the pinch gesture
			if( event.touches.length === 2 && touch.startCount === 2 && config.overview ) {

				// The current distance in pixels between the two touch points
				var currentSpan = distanceBetween( {
					x: event.touches[1].clientX,
					y: event.touches[1].clientY
				}, {
					x: touch.startX,
					y: touch.startY
				} );

				// If the span is larger than the desire amount we've got
				// ourselves a pinch
				if( Math.abs( touch.startSpan - currentSpan ) > touch.threshold ) {
					touch.handled = true;

					if( currentSpan < touch.startSpan ) {
						activateOverview();
					}
					else {
						deactivateOverview();
					}
				}

				event.preventDefault();

			}
			// There was only one touch point, look for a swipe
			else if( event.touches.length === 1 && touch.startCount !== 2 ) {

				var deltaX = currentX - touch.startX,
					deltaY = currentY - touch.startY;

				if( deltaX > touch.threshold && Math.abs( deltaX ) > Math.abs( deltaY ) ) {
					touch.handled = true;
					navigateLeft();
				}
				else if( deltaX < -touch.threshold && Math.abs( deltaX ) > Math.abs( deltaY ) ) {
					touch.handled = true;
					navigateRight();
				}
				else if( deltaY > touch.threshold ) {
					touch.handled = true;
					navigateUp();
				}
				else if( deltaY < -touch.threshold ) {
					touch.handled = true;
					navigateDown();
				}

				event.preventDefault();

			}
		}
		// There's a bug with swiping on some Android devices unless
		// the default action is always prevented
		else if( navigator.userAgent.match( /android/gi ) ) {
			event.preventDefault();
		}

	}

	/**
	 * Handler for the document level 'touchend' event.
	 */
	function onDocumentTouchEnd( event ) {

		touch.handled = false;

	}

	/**
	 * Handles mouse wheel scrolling, throttled to avoid skipping
	 * multiple slides.
	 */
	function onDocumentMouseScroll( event ) {

		clearTimeout( mouseWheelTimeout );

		mouseWheelTimeout = setTimeout( function() {
			var delta = event.detail || -event.wheelDelta;
			if( delta > 0 ) {
				navigateNext();
			}
			else {
				navigatePrev();
			}
		}, 100 );

	}

	/**
	 * Clicking on the progress bar results in a navigation to the
	 * closest approximate horizontal slide using this equation:
	 *
	 * ( clickX / presentationWidth ) * numberOfSlides
	 */
	function onProgressClicked( event ) {

		event.preventDefault();

		var slidesTotal = toArray( document.querySelectorAll( HORIZONTAL_SLIDES_SELECTOR ) ).length;
		var slideIndex = Math.floor( ( event.clientX / dom.wrapper.offsetWidth ) * slidesTotal );

		slide( slideIndex );

	}

	/**
	 * Event handler for navigation control buttons.
	 */
	function onNavigateLeftClicked( event ) { event.preventDefault(); navigateLeft(); }
	function onNavigateRightClicked( event ) { event.preventDefault(); navigateRight(); }
	function onNavigateUpClicked( event ) { event.preventDefault(); navigateUp(); }
	function onNavigateDownClicked( event ) { event.preventDefault(); navigateDown(); }
	function onNavigatePrevClicked( event ) { event.preventDefault(); navigatePrev(); }
	function onNavigateNextClicked( event ) { event.preventDefault(); navigateNext(); }

	/**
	 * Handler for the window level 'hashchange' event.
	 */
	function onWindowHashChange( event ) {

		readURL();

	}

	/**
	 * Handler for the window level 'resize' event.
	 */
	function onWindowResize( event ) {

		layout();

	}

	/**
	 * Invoked when a slide is and we're in the overview.
	 */
	function onOverviewSlideClicked( event ) {

		// TODO There's a bug here where the event listeners are not
		// removed after deactivating the overview.
		if( eventsAreBound && isOverview() ) {
			event.preventDefault();

			var element = event.target;

			while( element && !element.nodeName.match( /section/gi ) ) {
				element = element.parentNode;
			}

			if( element && !element.classList.contains( 'disabled' ) ) {

				deactivateOverview();

				if( element.nodeName.match( /section/gi ) ) {
					var h = parseInt( element.getAttribute( 'data-index-h' ), 10 ),
						v = parseInt( element.getAttribute( 'data-index-v' ), 10 );

					slide( h, v );
				}

			}
		}

	}


	// --------------------------------------------------------------------//
	// ------------------------------- API --------------------------------//
	// --------------------------------------------------------------------//


	return {
		initialize: initialize,
		configure: configure,

		// Navigation methods
		slide: slide,
		left: navigateLeft,
		right: navigateRight,
		up: navigateUp,
		down: navigateDown,
		prev: navigatePrev,
		next: navigateNext,
		prevFragment: previousFragment,
		nextFragment: nextFragment,

		// Deprecated aliases
		navigateTo: slide,
		navigateLeft: navigateLeft,
		navigateRight: navigateRight,
		navigateUp: navigateUp,
		navigateDown: navigateDown,
		navigatePrev: navigatePrev,
		navigateNext: navigateNext,

		// Forces an update in slide layout
		layout: layout,

		// Toggles the overview mode on/off
		toggleOverview: toggleOverview,

		// Toggles the "black screen" mode on/off
		togglePause: togglePause,

		// State checks
		isOverview: isOverview,
		isPaused: isPaused,

		// Adds or removes all internal event listeners (such as keyboard)
		addEventListeners: addEventListeners,
		removeEventListeners: removeEventListeners,

		// Returns the indices of the current, or specified, slide
		getIndices: getIndices,

		// Returns the slide at the specified index, y is optional
		getSlide: function( x, y ) {
			var horizontalSlide = document.querySelectorAll( HORIZONTAL_SLIDES_SELECTOR )[ x ];
			var verticalSlides = horizontalSlide && horizontalSlide.querySelectorAll( 'section' );

			if( typeof y !== 'undefined' ) {
				return verticalSlides ? verticalSlides[ y ] : undefined;
			}

			return horizontalSlide;
		},

		// Returns the previous slide element, may be null
		getPreviousSlide: function() {
			return previousSlide;
		},

		// Returns the current slide element
		getCurrentSlide: function() {
			return currentSlide;
		},

		// Returns the current scale of the presentation content
		getScale: function() {
			return scale;
		},

		// Helper method, retrieves query string as a key/value hash
		getQueryHash: function() {
			var query = {};

			location.search.replace( /[A-Z0-9]+?=(\w*)/gi, function(a) {
				query[ a.split( '=' ).shift() ] = a.split( '=' ).pop();
			} );

			return query;
		},

		// Returns true if we're currently on the first slide
		isFirstSlide: function() {
			return document.querySelector( SLIDES_SELECTOR + '.past' ) == null ? true : false;
		},

		// Returns true if we're currently on the last slide
		isLastSlide: function() {
			if( currentSlide && currentSlide.classList.contains( '.stack' ) ) {
				return currentSlide.querySelector( SLIDES_SELECTOR + '.future' ) == null ? true : false;
			}
			else {
				return document.querySelector( SLIDES_SELECTOR + '.future' ) == null ? true : false;
			}
		},

		// Forward event binding to the reveal DOM element
		addEventListener: function( type, listener, useCapture ) {
			if( 'addEventListener' in window ) {
				( dom.wrapper || document.querySelector( '.reveal' ) ).addEventListener( type, listener, useCapture );
			}
		},
		removeEventListener: function( type, listener, useCapture ) {
			if( 'addEventListener' in window ) {
				( dom.wrapper || document.querySelector( '.reveal' ) ).removeEventListener( type, listener, useCapture );
			}
		}
	};

})();
