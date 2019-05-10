sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"../model/formatter",
	"sap/ui/core/routing/History",
	"sap/ui/Device",
	"sap/ui/model/json/JSONModel",
	"jquery.sap.global"
], function(Controller, formatter, History, Device, JSONModel, jQuery) {
	"use strict";

	return Controller.extend("sap.ui.demo.basicTemplate.controller.App", {

		formatter: formatter,

		onInit: function () {
		    sap.ui.core.BusyIndicator.show(0);
		    this.odb = false;
		    self = this;
		    var oDeviceModel = new JSONModel(Device);
			oDeviceModel.setDefaultBindingMode("OneWay");
			this.getView().setModel(oDeviceModel, "device");
			window._timeline = this.byId("idTimeline");
			window._card1 = this.byId("Card1");
			window._card2 = this.byId("Card2");
			window._card3 = this.byId("Card3");
			window.vMap = this.byId("vbiMap");
			this.setTiles();
			this.get_stream = true;
            window._stream_index = 0;

		},

		getStream: function() {

                var oData = {'cur_index': window._stream_index}

                jQuery.ajax({
                    url : "/get_stream",
                    type : "POST",
                    dataType : "json",
                    data: oData,
                    async : true,
                    success : function(response, jqXHR, textStatus){

                        var oModel = new JSONModel(response);
                        sap.m.MessageToast.show(response.message);
                        window._stream_index = response.new_index;

                    },
                    error: function(response){
                        console.log(response);
                        sap.ui.core.BusyIndicator.hide(0);
                    }
                });

		},

		setTiles: function() {
            jQuery.ajax({
                url : "/get_init_data",
                type : "GET",
                dataType : "json",
                async : true,
                success : function(response, jqXHR, textStatus){

                    var oModel = new JSONModel(response);
                    sap.ui.getCore().setModel(oModel, 'LaunchpadStats');
                    window._card1.setModel(oModel);
                    window._card2.setModel(oModel);
                    window._card3.setModel(oModel);
                    window._timeline.setModel(oModel);
                    sap.ui.core.BusyIndicator.hide(0);
                    sap.m.MessageToast.show(response.message);

                },
                error: function(response){
                    console.log(response);
                    sap.ui.core.BusyIndicator.hide(0);
                }
            });

		},

		press: function(tile) {

			var selectedData = {};
			sap.ui.core.BusyIndicator.show(0);
			this.getData(tile).done(function(result) {
				var oModel = new sap.ui.model.json.JSONModel(result.d);
				sap.ui.getCore().setModel(oModel, tile + 'Model');
				if(self.odb === true){
				    sap.ui.core.BusyIndicator.hide(0);
				}
				if(tile === 'OrientDB'){
				    self.odb = true;
				}
				self.routeToApp(tile);

			}).fail(function(result) {
				console.log(result);
			});

		},
		onNavBack: function() {

			var sPreviousHash = History.getInstance().getPreviousHash();

			if (sPreviousHash !== undefined) {
				history.go(-1);
			} else {
				this.getRouter().navTo("home", {}, true);
			}
		},

		getData: function(url){
			return jQuery.ajax({
				url: url,
				type: "GET"
			});
		},

		getRouter : function () {
			return sap.ui.core.UIComponent.getRouterFor(this);
		},

		routeToApp: function(tile) {
			this.getRouter().navTo(tile, {});

		},
				onLazyLoadingSelected: function (oEvent) {
			var bSelected = oEvent.getParameter("selected");
			this._timeline.setLazyLoading(bSelected);
			this._setMessage();

			this._bindTimelineAggregation();
		},
		onNoPagingPress: function (oEvent) {
			this._timeline.setGrowingThreshold(0);
			this._timeline.setLazyLoading(false);

			this.byId("idLazyLoading").setSelected(false);
			this.byId("idGrowing").setSelected(false);

			this._setMessage();
			this._bindTimelineAggregation();
		},
		onGrowingSelected: function (oEvent) {
			var bSelected = oEvent.getParameter("selected");
			var iThreshold = bSelected ? 10 : 0;

			this._timeline.setGrowingThreshold(iThreshold);
			this._setMessage();
			this._bindTimelineAggregation();
		},
		orientationChanged: function (oEvent) {
			var sKey = oEvent.getParameter("selectedItem").getProperty("key");
			this._timeline.setAxisOrientation(sKey);
		},
		onScrollbarSelected: function (oEvent) {
			var bSelected = oEvent.getParameter("selected");
			this._timeline.setEnableScroll(bSelected);
			this._setMessage();

			// in production you would probably want to use something like ScrollContainer
			// but for demo purpose we want to keep it simple
			// this allows scrolling for horizontal mode without EnableScrollbar ON
			jQuery("section").css("overflow-x", "auto");
			this._bindTimelineAggregation();
		},
		_setMessage: function () {
			if (!this._timeline.getLazyLoading() && !this._timelineHasGrowing()) {
				this._timeline.setCustomMessage("Both 'lazy loading' and 'growing' is turned off. All items are loaded and displayed");
				return;
			}

			if (this._timeline.getLazyLoading() && this._timelineHasGrowing()) {
				if (!this._timeline.getEnableScroll()) {
					this._timeline.setCustomMessage("EnableScroll is OFF - 'Lazy loading' can't be used so 'growing' threshold is appllied.");
				} else {
					this._timeline.setCustomMessage("EnableScroll is ON - Both 'lazy loading' and 'growing' can be used, but 'lazy loading' has priority.'");
				}
				return;
			}

			if (!this._timeline.getEnableScroll()) {
				if (this._timeline.getLazyLoading()) {
					this._timeline.setCustomMessage("EnableScroll is OFF - lazy loading can't be applied.");
				} else if (this._timelineHasGrowing()) {
					this._timeline.setCustomMessage("EnableScroll is OFF but growing still works.");
				}
			} else {
				this._timeline.setCustomMessage("EnableScroll is ON - both lazy loading and growing can be used (depends on settings).");
			}
		},
		_bindTimelineAggregation: function () {
			this._timeline.bindAggregation("content", {
				path: "/Items",
				template: this.byId("idTemplateItem").clone()
			});
		},
		_timelineHasGrowing: function () {
			return this._timeline.getGrowingThreshold() !== 0;
		}
	});
});