getStream = function() {

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
                        self.startStream();

                    },
                    error: function(response){
                        console.log(response);
                        sap.ui.core.BusyIndicator.hide(0);
                    }
                });

		},