/* global wp, _ */

// Make sure the wp object exists.
window.wp = window.wp || {};
window.wpUserMedia = window.wpUserMedia || _.extend( {}, _.pick( window.wp, 'Backbone', 'template' ) );

( function( $ ) {

	wpUserMedia.Models      = wpUserMedia.Models || {};
	wpUserMedia.Collections = wpUserMedia.Collections || {};
	wpUserMedia.Views       = wpUserMedia.Views || {};

	// Extend wp.Backbone.View with .prepare()
	wpUserMedia.View = wpUserMedia.Backbone.View.extend( {
		prepare: function() {
			if ( ! _.isUndefined( this.model ) && _.isFunction( this.model.toJSON ) ) {
				return this.model.toJSON();
			} else {
				return {};
			}
		}
	} );

	wpUserMedia.Views.User = wpUserMedia.View.extend( {
		tagName:    'li',
		className:  'user',
		template: wpUserMedia.template( 'wp-user-media-user' )
	} );

	wpUserMedia.Views.Feedback = wpUserMedia.Views.User.extend( {
		className: 'notice',
		template: wpUserMedia.template( 'wp-user-media-feedback' ),

		events: {
			'click .notice-dismiss' : 'removeSelf'
		},

		initialize: function() {
			_.extend( this.model.attributes, _.pick( wpUserMediaSettings.common, 'dismissibleText' ) );

			if ( this.model.get( 'type' ) ) {
				this.el.className += ' ' + this.model.get( 'type' );
			}

			if ( this.model.get( 'dismissible' ) ) {
				this.el.className += ' is-dismissible';
			}
		},

		removeSelf: function() {
			this.remove();
		}
	} );

	wpUserMedia.Views.Users = wpUserMedia.View.extend( {
		tagName:   'ul',
		className: 'users',

		events: {
			'click a.user-link' : 'displayUserMedia'
		},

		initialize: function() {
			this.collection.on( 'add', this.prepareNewView, this );

			this.isRequestingMore = false;

			$( document ).on( 'scroll', _.bind( this.scroll, this ) );
		},

		prepareNewView: function( model ) {
			var o = this.options || {};

			o.ghost.add( model );

			this.addItemView( model );
		},

		addItemView: function( user ) {
			this.views.add( new wpUserMedia.Views.User( { model: user } ) );
		},

		displayUserMedia: function( event ) {
			event.preventDefault();

			var user_id = $( event.currentTarget ).data( 'id' );

			_.each( this.collection.models, function( model ) {
				var attributes = { current: false };
				if ( user_id === model.get( 'id' ) ) {
					attributes.current = true;
				}

				model.set( attributes );
			} );
		},

		/**
		 * Edit the more query by extending this method.
		 *
		 * @return {object} Additionnal Query Parameters for the more query if needed.
		 */
		getScrollData: function() {
			return {};
		},

		scroll: function() {
			var listOffset = $( this.el ).offset(), el = document.body,
			    scrollTop = $( document ).scrollTop(), sensibility = 20;

			if ( $( '#wpadminbar' ).length ) {
				sensibility += $( '#wpadminbar' ).height();
			}

			if ( ! this.collection.hasMore() || this.isRequestingMore || this.$el.hasClass( 'loading' ) ) {
				return;
			}

			if ( scrollTop + el.clientHeight + sensibility > this.el.clientHeight + listOffset.top ) {
				var data = this.getScrollData();
				this.isRequestingMore = true;

				this.collection.more( {
					data    : data,
					success : _.bind( this.resetRequestingMore, this ),
					error   : _.bind( this.resetRequestingMore, this )
				} );
			}
		},

		resetRequestingMore: function() {
			this.isRequestingMore = false;
		}
	} );

	wpUserMedia.Views.Droppable = wpUserMedia.View.extend( {
		initialize: function() {
			this.$el.attr( 'data-id',   this.model.get( 'id' ) );
			this.$el.bind( 'dragover',  _.bind( this.dragOver, this  ) );
			this.$el.bind( 'dragenter', _.bind( this.dragOver, this  ) );
			this.$el.bind( 'dragleave', _.bind( this.dragLeave, this ) );
			this.$el.bind( 'drop',      _.bind( this.dropIn, this    ) );

			this.isDroppable = true;
		},

		dragOver: function( event ) {
			var e = event;

			e.preventDefault();

			if ( e.originalEvent ) {
				e = e.originalEvent;
			}

			if ( -1 === _.indexOf( e.dataTransfer.types, 'modelid' ) || ! this.isDroppable ) {
				return false;
			}

			if ( ! this.$el.hasClass( 'drag-over' ) ) {
				this.$el.addClass( 'drag-over' );
			}

			return false;
		},

		dragLeave: function( event ) {
			event.preventDefault();

			if ( ! this.isDroppable ) {
				return false;
			}

			if ( this.$el.hasClass( 'drag-over' ) ) {
				this.$el.removeClass( 'drag-over' );
			}

			return false;
		},

		dropIn: function( event ) {
			var e = event;

			if ( e.originalEvent ) {
				e = e.originalEvent;
			}

			if ( ! this.isDroppable ) {
				return false;
			}

			if ( this.$el.hasClass( 'drag-over' ) ) {
				this.$el.removeClass( 'drag-over' );
			}

			this.handleDrop( e.dataTransfer.getData( 'modelId' ) );
		},

		/**
		 * Update the User Media Parent dir
		 *
		 * @param  {integer} id The User Media ID.
		 */
		handleDrop: function( id ) {
			if ( _.isUndefined( id ) ) {
				return;
			}

			var model = this.options.ghost.get( id ), parent = this.model.get( 'id' );

			if ( _.isNaN( parent ) ) {
				parent = 0;
			}

			$( '#trail ul' ).first().addClass( 'loading' );
			$( '#media ul' ).first().addClass( 'loading' );

			// Let's make sure the PUT verb won't be blocked by the server.
			Backbone.emulateHTTP = true;

			model.save( {
				'post_parent': this.model.get( 'id' )
			}, {
				success: _.bind( this.userMediaMoved, this )
			} );
		},

		/**
		 * Wait untill the model is successfully saved before
		 * removing it from the ghost collection.
		 *
		 * @param  {Backbone.Model} model The User Media object.
		 */
		userMediaMoved: function( model ) {
			$( '#trail ul' ).first().removeClass( 'loading' );
			$( '#media ul' ).first().removeClass( 'loading' );

			this.options.ghost.remove( model );
		}
	} );

	wpUserMedia.Views.UserMedia = wpUserMedia.Views.Droppable.extend( {
		tagName:    'li',
		className:  'user-media',
		template: wpUserMedia.template( 'wp-user-media-media' ),

		events: {
			'click .delete' : 'deleteUserMedia'
		},

		initialize: function() {
			if ( this.model.get( 'uploading' ) ) {
				// Show Upload progress
				this.model.on( 'change:percent', this.progress, this );

				// Replace the uploaded file with the User Media model.
				this.model.on( 'change:guid', this.update, this );

				this.model.on( 'destroy', this.remove, this );

			// The dir background is specific.
			} else if ( 'dir' === this.model.get( 'media_type' ) ) {
				this.el.className += ' dir droppable';
				wpUserMedia.Views.Droppable.prototype.initialize.apply( this, arguments );

			// Set additionnal properties
			} else {
				this.setMediaProps();
			}
		},

		setMediaProps: function() {
			this.$el.prop( 'draggable', true );
			this.$el.attr( 'data-id', this.model.get( 'id' ) );

			if ( 'image' === this.model.get( 'media_type' ) && this.model.get( 'guid' ) ) {
				var bgUrl = this.model.get( 'guid' ).rendered,
				    mediaDetails = this.model.get( 'media_details' ), fileName;

				if ( _.isObject( mediaDetails.medium ) ) {
					fileName = mediaDetails.file.split( '/' );
					bgUrl = bgUrl.replace( fileName[ oFile.length - 1 ], mediaDetails.medium.file );
				}

				this.model.set( { background: bgUrl }, { silent: true } );
			}

			this.model.set( { download: this.model.get( 'link' ) + wpUserMediaSettings.common.downloadSlug + '/' }, { silent: true } );

			// Files need their root Url to be set as the Rest Endpoint.
			if ( true === this.model.previous( 'uploading' ) ) {
				_.extend( this.model, { urlRoot: wpUserMedia.App.overrides.url } );
			}
		},

		progress: function( file ) {
			if ( ! _.isUndefined( file.get( 'percent' ) ) ) {
				$( '#' + file.get( 'id' ) + ' .wp-user-media-progress .wp-user-media-bar' ).css( 'width', file.get('percent') + '%' );
			}
		},

		update: function( file ) {
			_.each( ['date', 'filename', 'uploading', 'subtype' ], function( attribute ) {
				file.unset( attribute, { silent: true } );
			} );

			this.setMediaProps();
			this.render();
		},

		deleteUserMedia: function( event ) {
			event.preventDefault();

			// Let's make sure the DELETE verb won't be blocked by the server.
			Backbone.emulateHTTP = true;

			$( '#trail ul' ).first().addClass( 'loading' );
			$( '#media ul' ).first().addClass( 'loading' );

			// Destroy the model.
			this.model.destroy( {
				wait: true,
				success: _.bind( this.userMediaDeleted, this )
			} );
		},

		userMediaDeleted: function( model ) {
			$( '#trail ul' ).first().removeClass( 'loading' );
			$( '#media ul' ).first().removeClass( 'loading' );

			// Remove the model.
			this.options.ghost.remove( model );
		}
	} );

	wpUserMedia.Views.UserMedias = wpUserMedia.Views.Users.extend( {
		tagName:   'ul',
		className: 'user-media',

		events: {
			'dblclick .dir .user-media-content'    : 'openDir',
			'click .dir .user-media-actions a.edit' : 'openDir',
			'dragstart [draggable=true]' : 'setDragData'
		},

		initialize: function() {
			var o = this.options || {};

			wpUserMedia.Views.Users.prototype.initialize.apply( this, arguments );

			// Init the view with default Query Vars.
			this.queryUserMedia();

			// Listen to Query Vars changes
			this.listenTo( o.queryVars, 'change:parent', this.getChildren );

			// Listen to User Media removed from the ghost Collection
			this.listenTo( o.ghost, 'remove', this.adjustMore );
		},

		/**
		 * When a User Media is moved into a dir, we need to remove its view
		 * and make sure to exclude displayed User Media from the more Query.
		 *
		 * @param  {Backbone.Model} model The User Media Object
		 */
		adjustMore: function( model ) {
			var o = this.options || {}, modelId = model.get( 'id' );

			this.excludeDisplayed = []

			// Remove the moved User Media from the list.
			if ( ! _.isUndefined( this.views._views[''] ) && this.views._views[''].length && modelId ) {
				_.each( this.views._views[''], function( view ) {
					if ( modelId === view.model.get( 'id' ) ) {
						view.remove();
					} else {
						this.excludeDisplayed.push( view.model.get( 'id' ) );
					}
				}, this );
			}

			// Clean up the main collection if the Model is still in.
			if ( this.collection.get( modelId ) ) {
				this.collection.remove( modelId );
			}

			// Update the total available User Media for the query
			this.collection.state.totalObjects -= 1;

			// If All the User Media are displayed, no need to get more on scroll.
			if ( this.views._views[''].length >= this.collection.state.totalObjects ) {
				delete this.excludeDisplayed;
			}
		},

		/**
		 * Exclude Displayed User Media and reset page for the more Query if needed
		 *
		 * @return {object} Query Parameters.
		 */
		getScrollData: function() {
			var data = {};

			if ( _.isArray( this.excludeDisplayed ) ) {
				_.extend( data, {
					exclude: this.excludeDisplayed.join( ',' ),
					page   : 1
				} );

				delete this.excludeDisplayed;
			}

			return data;
		},

		queryUserMedia: function( options ) {
			var o = this.options || {};

			if ( _.isObject( options ) ) {
				o.queryVars.set( options );
			}

			// Clean subviews.
			if ( ! _.isUndefined( this.views._views[''] ) && this.views._views[''].length ) {
				_.each( this.views._views[''], function( view ) {
					view.remove();
				} );
			}

			this.collection.reset();
			this.collection.fetch( {
				data : o.queryVars.attributes,
				success : _.bind( this.doFeedback, this ),
				error   : _.bind( this.doFeedback, this )
			} );
		},

		removeFeedback: function() {
			if ( ! _.isUndefined( this.views._views[''] ) && this.views._views[''].length ) {
				_.each( this.views._views[''], function( view ) {
					if ( view.$el.hasClass( 'notice' ) ) {
						view.remove();
					}
				} );
			}
		},

		doFeedback: function( collection, request ) {
			var feedback = new Backbone.Model();

			if ( collection.length ) {
				return;
			}

			if ( _.isUndefined( request.responseJSON ) ) {
				feedback.set( {
					message: wpUserMediaSettings.common.noUserMedia,
					type:    'notice-warning'
				} );
			} else if ( ! _.isUndefined( request.responseJSON.message ) ) {
				feedback.set( {
					message: request.responseJSON.message,
					type:    'notice-error'
				} );
			} else {
				return;
			}

			this.views.add( new wpUserMedia.Views.Feedback( { model: feedback } ), { at: 0 } );
		},

		addItemView: function( userMedia ) {
			var o = this.options || {}, position = userMedia.get( 'at' );

			// Remove all feedbacks.
			this.removeFeedback();

			if ( _.isUndefined( position ) ) {
				this.views.add( new wpUserMedia.Views.UserMedia( { model: userMedia, ghost: o.ghost } ) );
			} else {
				this.views.add( new wpUserMedia.Views.UserMedia( { model: userMedia, ghost: o.ghost } ), { at: position } );
			}
		},

		openDir: function( event ) {
			event.preventDefault();

			var parent = $( event.currentTarget ).closest( '.dir' ).data( 'id' ),
			    o = this.options || {};

			if ( ! parent ) {
				return;
			}

			// Ask the listener to get dir's children
			o.queryVars.set( { parent: parent } );
		},

		getChildren: function( model, changed ) {
			if ( _.isUndefined( changed ) ) {
				return;
			}

			this.queryUserMedia();
		},

		setDragData: function( event ) {
			var e = event;

			if ( this.$el.closest( 'ul' ).hasClass( 'loading' ) ) {
				event.preventDefault();
				return false;
			}

			if ( e.originalEvent ) {
				e = e.originalEvent;
			}

			e.dataTransfer.setData( 'modelId', $( event.currentTarget ).data( 'id' ) );
		}
	} );

	wpUserMedia.Views.uploaderProgress = wpUserMedia.View.extend( {
		tagName: 'div',
		className: 'wp-user-media-status',
		template: wpUserMedia.template( 'wp-user-media-progress' ),

		initialize: function() {
			this.model.on( 'change:percent', this.progress, this );
		},

		progress: function( model ) {
			if ( ! _.isUndefined( model.get( 'percent' ) ) ) {
				$( '#' + model.get( 'id' ) + ' .wp-user-media-progress .wp-user-media-bar' ).css( 'width', model.get('percent') + '%' );
			}
		}
	} );

	wpUserMedia.Views.MkDir = wpUserMedia.View.extend( {
		tagName: 'div',
		id: 'directory-form',
		className: 'postbox',
		template: wpUserMedia.template( 'wp-user-media-dirmaker' ),

		events: {
			'click button.close' : 'removeSelf',
			'click #create-dir'  : 'createDir'
		},

		initialize: function() {
			this.model.set( _.pick( wpUserMediaSettings.common, 'closeBtn' ), { silent: true } );
		},

		removeSelf: function( event ) {
			if ( _.isObject( event ) && event.currentTarget ) {
				event.preventDefault();
			}

			wpUserMedia.App.toolbarItems.get( this.options.toolbarItem ).set( { active: false } );
		},

		createDir: function( event ) {
			event.preventDefault();

			var form = $( event.currentTarget ).closest( 'form' ), dirData = {},
			    p = this.options.params || {};

			_.each( $( form ).serializeArray(), function( pair ) {
				pair.name = pair.name.replace( '[]', '' );
				dirData[ pair.name ] = pair.value;
			} );

			// Missing title!
			if ( ! dirData.title ) {
				return;
			}

			_.extend( dirData, p );

			var dir = new wp.api.models.UserMedia( dirData );
			dir.save( {
				action: 'mkdir_user_media'
			}, {
				success: _.bind( this.mkdirSuccess, this ),
				error: _.bind( this.mkdirError, this )
			} );
		},

		mkdirSuccess: function( model ) {
			model.set( { at: 0 }, { silent: true } );
			wpUserMedia.App.userMedia.add( model );
			this.removeSelf();
		},

		mkdirError: function( error ) {
			console.log( error );
		}
	} );

	wpUserMedia.Views.Uploader = wpUserMedia.Views.MkDir.extend( {
		id: wpUserMediaSettings.params.container,
		className: 'wp-user-media-uploader-box',
		template: wpUserMedia.template( 'wp-user-media-uploader' ),

		initialize: function() {
			this.model = new Backbone.Model( wpUserMediaSettings.params );
			this.on( 'ready', this.initUploader );

			wpUserMedia.Views.MkDir.prototype.initialize.apply( this, arguments );
		},

		initUploader: function() {
			var pluploadOptions = _.mapObject( _.pick( this.model.attributes, 'container', 'browser', 'dropzone' ), function( v, k ) {
				return '#' + v;
			} );

			_.extend( pluploadOptions, this.options || {} );
			this.uploader = new wpUserMedia.Uploader( pluploadOptions );

			this.uploader.filesError.on( 'add', this.uploadError, this );
			this.uploader.filesQueue.on( 'add', this.addProgressView, this );
			this.uploader.filesQueue.on( 'reset', this.removeSelf, this );
		},

		uploadError: function( error ) {
			var o = this.options || {}, file, errorData,
			    feedback = new Backbone.Model( {
			    	dismissible: true,
			    	type: 'notice-error'
			    } );

			file = error.get( 'file' );
			errorData = error.get( 'data' );

			if ( error.get( 'feedback' ) ) {
				feedback.set( { message: error.get( 'feedback' ) } );
			} else {
				feedback.set( { message: errorData.message } );
			}

			if ( _.isObject( o.mediaView ) ) {
				var model = o.mediaView.collection.get( file.id );
				o.mediaView.collection.remove( file.id );

				// The message should be preprended with the File name.
				o.mediaView.views.add( new wpUserMedia.Views.Feedback( { model: feedback } ), { at: 0 } );
			} else {
				this.views.add( '#wp-user-media-upload-status', new wpUserMedia.Views.Feedback( { model: feedback } ) );
			}
		},

		addProgressView: function( file ) {
			var o = this.options || {};

			if ( ! _.isObject( o.mediaView ) ) {
				this.views.add( '#wp-user-media-upload-status', new wpUserMedia.Views.uploaderProgress( { model: file } ) );
			} else {
				o.mediaView.collection.add( file.set( { at: 0 }, { silent: true } ) );
			}
		}
	} );

	wpUserMedia.Views.ToolbarItem = wpUserMedia.View.extend( {
		tagName  : 'li',
		template: wpUserMedia.template( 'wp-user-media-toolbar-item' ),

		initialize: function() {
			if ( this.model.get( 'current' ) ) {
				this.el.className = 'current';
			}

			this.model.on( 'change:disable', this.refreshItem, this );
		},

		refreshItem: function( model, changed ) {
			var element = $( this.$el ).find( 'button' ).first();

			element.prop( 'disabled', changed );
		}
	} );

	wpUserMedia.Views.Toolbar = wpUserMedia.View.extend( {
		tagName  : 'ul',
		className: 'filter-links',

		events: {
			'click button' : 'activateView'
		},

		initialize: function() {
			var o = this.options || {}, position = 0, current = false;

			_.each( wpUserMediaSettings.toolbarItems, function( name, id ) {
				position += 1;

				if ( o.users.length && 'users' === id ) {
					current = true;
				} else {
					current = false;
				}

				this.collection.add( {
					id: id,
					name: name,
					position: position,
					current: current,
					disable: 0 !== o.users.length && 'users' !== id,
				} );

				this.addItemBar( this.collection.get( id ) );
			}, this );

			this.collection.on( 'change:current', this.refreshToolbar, this );
		},

		addItemBar: function( toolbarItem ) {
			this.views.add( new wpUserMedia.Views.ToolbarItem( { model: toolbarItem } ) );
		},

		refreshToolbar: function( model, changed ) {
			if ( false === changed || 'false' === changed ) {
				return;
			}

			_.each( this.$el.children(), function( e ) {
				$( e ).removeClass( 'current' );
			} );

			$( this.$el ).find( '[data-id="' + model.get( 'id' ) + '"]' ).parent( 'li' ).addClass( 'current' );
		},

		activateView: function( event ) {
			event.preventDefault();

			var current = $( event.currentTarget ), model, disable = false, subview = null;

			if ( current.prop( 'disabled' ) ) {
				return;
			}

			if ( 'upload' === current.data( 'id' ) || 'directory' === current.data( 'id' ) ) {
				subview = current.data( 'id' );
			} else if ( 'users' === current.data( 'id' ) ) {
				disable = true;
			}

			_.each( this.collection.models, function( model ) {
				var attributes = { disable: disable, current: false, active: false };

				if ( ! _.isNull( subview ) ) {
					if ( model.get( 'id' ) === subview ) {
						attributes.active  = true;
					} else {
						attributes.current = model.get( 'current' );
					}

				} else if ( model.get( 'id' ) === current.data( 'id' ) ) {
					attributes.current = true;

					if ( 'users' === model.get( 'id' ) ) {
						attributes.disable = false;
					}
				}

				model.set( attributes );
			}, this );
		}
	} );

	wpUserMedia.Views.trailItem = wpUserMedia.Views.Droppable.extend( {
		tagName  : 'li',
		template: wpUserMedia.template( 'wp-user-media-trail' ),

		initialize: function() {
			wpUserMedia.Views.Droppable.prototype.initialize.apply( this, arguments );

			this.isDroppable = false;

			if ( this.model.get( 'showLink') ) {
				this.model.unset( 'showLink', { silent: true } );
			}

			// Update the trailItem link
			this.model.on( 'change:showLink', this.rerender, this );

			// Remove the trailItem view
			this.model.on( 'remove', this.remove, this );
		},

		rerender: function( model, changed ) {
			if ( true === changed ) {
				this.isDroppable = true;
			}

			this.render();
		}
	} );

	wpUserMedia.Views.Trail = wpUserMedia.View.extend( {
		tagName  : 'ul',
		className: 'trail-links',

		events: {
			'click a' : 'moveUp'
		},

		initialize: function() {
			this.collection.on( 'reset', this.resetTrail, this );
			this.collection.on( 'add', this.addTrailItem, this );
		},

		resetTrail: function() {
			// Clean subviews.
			if ( ! _.isUndefined( this.views._views[''] ) && this.views._views[''].length ) {
				_.each( this.views._views[''], function( view ) {
					view.remove();
				} );
			}
		},

		addTrailItem: function( trailItem ) {
			this.views.add( new wpUserMedia.Views.trailItem( { model: trailItem, ghost: this.options.ghost } ) );
		},

		moveUp: function( event ) {
			var o = this.options || {}, action;

			event.preventDefault();

			action = $( event.currentTarget ).prop( 'class' );

			if ( 'root-dir' === action ) {
				o.queryVars.set(
					{ parent: 0 },
					{ 'move' : action }
				);
			} else if ( 'parent-dir' === action ) {
				o.queryVars.set(
					{ parent: $( event.currentTarget ).data( 'id' ) },
					{ 'move' : action }
				);
			}
		}
	} );

	wpUserMedia.Views.Root = wpUserMedia.View.extend( {

		initialize: function() {
			var o = this.options || {};

			this.ghost = new Backbone.Collection();

			this.views.add( '#users', new wpUserMedia.Views.Users( { collection: o.users, ghost: this.ghost } ) );

			this.listenTo( o.users, 'reset', this.queryUsers );
			o.users.on( 'change:current', this.setToolbar, this );
			o.users.reset();

			o.toolbarItems.on( 'change:active', this.displayForms, this );
			o.toolbarItems.on( 'change:current', this.manageLists, this );

			this.listenTo( o.queryVars, 'change:parent', this.updateTrail );
		},

		/**
		 * Admins will be able to list users. Listing a user's files needs to select the user.
		 * Regular users won't be able to do that and their own files will be automatically loaded.
		 */
		queryUsers: function() {
			var o = this.options || {};

			o.users.fetch( {
				data: { 'has_disk_usage' : true },
				success : _.bind( this.displayToolbar, this ),
				error   : _.bind( this.setToolbar, this )
			} );
		},

		/**
		 * Display the Main Toolbar
		 */
		displayToolbar: function() {
			var o = this.options || {};

			if ( ! _.isUndefined( this.views._views['#toolbar'] ) ) {
				return;
			}

			this.views.add( '#toolbar', new wpUserMedia.Views.Toolbar( {
				collection: o.toolbarItems,
				users: o.users
			} ) );
		},

		/**
		 * Adjust the Toolbar according to the current user's capabilities.
		 */
		setToolbar: function( model, changed ) {
			var o = this.options || {};

			if ( ! _.isUndefined( changed ) && false === changed ) {
				return;
			}

			// The User is not an admin.
			if ( _.isUndefined( this.views._views['#toolbar'] ) ) {
				delete wpUserMediaSettings.toolbarItems.users;

				this.displayToolbar();

				// Set the Public view as current one.
				o.toolbarItems.get( 'publish' ).set( { current: true } );

			// The User is an admin and has selected a user.
			} else {
				_.each( o.toolbarItems.models, function( model ) {
					var attributes = { disable: false, current: false };
					if ( 'publish' === model.get( 'id' ) ) {
						attributes.current = true;
					}

					model.set( attributes );
				} );
			}
		},

		displayForms: function( model, active ) {
			var o = this.options || {}, params = { 'post_status': 'publish' },
			    s = null, empty = _.isUndefined( this.views._views['#forms'] ) || 0 === this.views._views['#forms'].length;

			if ( -1 === _.indexOf( ['upload', 'directory'], model.get( 'id' ) ) ) {
				return;
			}

			if ( false === active ) {
				if ( empty ) {
					return;
				} else {
					_.each( this.views._views['#forms'], function( view ) {
						if ( ( 'upload' === model.get( 'id' ) && view.uploader ) || ( 'directory' === model.get( 'id' ) && ! view.uploader ) ) {
							view.remove();
						}
					} );
				}
			} else {
				if ( ! empty ) {
					_.each( this.views._views['#forms'], function( view ) {
						view.remove();
					} );
				}

				s = o.toolbarItems.findWhere( { current: true } );

				if ( _.isObject( s ) ) {
					params.post_status = s.get( 'id' );
				}

				if ( o.queryVars.get( 'parent' ) ) {
					params.post_parent = o.queryVars.get( 'parent' );
				}

				if ( o.queryVars.get( 'user_id' ) ) {
					params.user_id = o.queryVars.get( 'user_id' );
				}

				if ( 'upload' === model.get( 'id' ) ) {
					this.views.add( '#forms', new wpUserMedia.Views.Uploader( {
						overrides: o.overrides,
						params: params,
						toolbarItem: 'upload',
						mediaView: _.first( this.views._views['#media'] )
					} ) );
				} else {
					this.views.add( '#forms', new wpUserMedia.Views.MkDir( {
						params: params,
						toolbarItem: 'directory',
						model: new Backbone.Model( wpUserMediaSettings.dirmaker )
					} ) );
				}
			}
		},

		manageLists: function( model, changed ) {
			var o = this.options || {};

			if ( false === changed ) {
				if ( 'users' !== model.get( 'id' ) ) {
					_.first( this.views._views['#media'] ).remove();
				} else {
					_.first( this.views._views['#users'] ).remove();
				}
			} else {
				if ( 'users' === model.get( 'id' ) ) {
					this.views.add( '#users', new wpUserMedia.Views.Users( { collection: o.users, ghost: this.ghost } ) );
					o.users.reset();

					// Remove the trail when switching users.
					if ( ! _.isUndefined( this.views._views['#trail'] ) && 0 !== this.views._views['#trail'].length ) {
						_.first( this.views._views['#trail'] ).remove();
					}
				} else {
					// Add the trail view
					if ( _.isUndefined( this.views._views['#trail'] ) || 0 === this.views._views['#trail'].length ) {
						this.views.add( '#trail', new wpUserMedia.Views.Trail( {
							collection: o.trailItems,
							ghost:     this.ghost,
							queryVars: o.queryVars
						} ) );
					}

					// Reset the trail collection
					o.trailItems.reset();

					// Reset the Query vars
					o.queryVars.clear();
					o.queryVars.set( {
						'user_media_context': 'admin',
						'post_status': model.get( 'id' ),
						'parent'     : 0
					} );

					// Set the User ID.
					if ( o.users.length ) {
						var author = o.users.findWhere( { current: true } );
						o.queryVars.set( { 'user_id': author.get( 'id' ) } );

						// Add the User to trail
						o.trailItems.add( author );
					} else {
						o.queryVars.set( { 'user_id': 0 } );
					}

					// Add the Status
					o.trailItems.add( model );

					// Add the media view
					this.views.add( '#media', new wpUserMedia.Views.UserMedias( {
						collection: o.media,
						ghost:      this.ghost,
						queryVars:  o.queryVars
					} ) );
				}
			}
		},

		updateTrail: function( model, changed, options ) {
			var o = this.options || {}, dir, parent, status;

			if ( _.isUndefined( changed ) ) {
				return;
			}

			dir = this.ghost.get( changed );

			// Move down into the dirs tree
			if ( ! _.isUndefined( dir ) && ! options.move ) {

				if ( 0 === dir.get( 'parent' ) ) {
					status = o.toolbarItems.findWhere( { current: true } );
					parent = o.trailItems.get( status.get( 'id' ) );
					parent.set( { showLink: true } );

				} else {
					parent = o.trailItems.get( dir.get( 'parent' ) );
					parent.set( { showLink: true } );
				}

				// Add to trail the current displayed folder.
				o.trailItems.add( this.ghost.get( changed ) );

			// Move up into the dirs tree
			} else if ( options.move ) {
				if ( 'root-dir' === options.move ) {
					status = o.toolbarItems.findWhere( { current: true } );
					parent = o.trailItems.get( status.get( 'id' ) );
					parent.set( { showLink: false } );
				} else {
					parent = o.trailItems.get( changed );
					parent.set( { showLink: false } );
				}

				var remove = o.trailItems.where( { 'media_type': 'dir' } );

				// Remove from trail the children.
				_.each( remove, function( trailItem ) {
					if ( 'root-dir' === options.move || trailItem.get( 'id' ) > changed ) {
						o.trailItems.remove( trailItem );
					}
				} );
			}
		}
	} );

} )( jQuery );
