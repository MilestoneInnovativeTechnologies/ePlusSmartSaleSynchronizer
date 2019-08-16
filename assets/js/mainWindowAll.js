// const { ipcRenderer,remote } = require('electron'), { dialog,BrowserWindow } = remote, currentWindow = remote.getCurrentWindow(),
//     $ = require('jquery'), _ = require('lodash'), fs = require('fs'), db = require('mysql'), url = require('url'), path = require('path'),
//     protocol = 'http', hostname = 'mit', pathname = 'api/ss/sync/table/{id}/set', directionMap = { up:'to',down:'from',from:'down',to:'up' }
// ;
// const quitConfirmOptions = { type: 'info', title: 'Confirm Quit', message: 'Are you sure, you want to quit ?', buttons: ['No, go Back','Yes, Quit'] },
//     maxLog = 15, continueInterval = 1000
// ;
// let ssConfig, syncInfo, mysql = null, tblData = {}, syncFile, userPath, uuidFilePath, client,
//     processQueue = {}, doContinue = true, inWork = false, workTimeOut = 0, tray = null;

// ipcRenderer.on('tray-destroyed',function(){ tray = null; currentWindow.show(); });

// $(function(){
//     initApp(ipcRenderer.sendSync('get-all-config'));
//     setInterval(doProcessQueue,continueInterval);
// });

// function initApp(configs){
//     log('Initializing sync..');
//     syncInfo = configs.syncInfo; syncFile = configs.syncFilePath; userPath = configs.userPath; uuidFilePath = configs.uuidFilePath;
//     setupApp(configs.ssConfig); setupMysqlConnection(configs.mysqlParams);
//     loadTblData(function(){ _.forEach(syncInfo,initTable); });
// }


// function setupApp(config){
//     ssConfig = config;
//     $('#company_name').text(ssConfig.name); $('#application').text(ssConfig.application);
//     fs.readFile(uuidFilePath,function(error,uuid){
//         if(error) log('Error in reading uuid file!!');
//         client = uuid.toString();
//     })
// }

// function setupMysqlConnection(mysqlParams){
//     mysql = db.createConnection(_.assign({ dateStrings:true },mysqlParams));
//     mysql.connect(function(error){ if(!error) return log('Database connection established..'); mysql = null; log('Could not establish database connection.'); });
// }

// function initTable(data){
//     const { id,table,last_updated,last_created,sync_to_ttl,sync_from_ttl } = data, timeNow = getTimeNow();
//     let source = { id, updated: last_updated, created: last_created, to:parseInt(sync_to_ttl), from:parseInt(sync_from_ttl) };
//     //let source = { id, updated: last_updated, created: last_created, to:5, from:parseInt(sync_from_ttl) };
//     if(!_.has(tblData,table)) tblData[table] = source; else _.assign(tblData[table],source);
//     if(!_.has(tblData[table],'primary_key') || _.isEmpty(tblData[table].primary_key))
//         getTablePrimaryFields(table).then(function(Obj){ _.forEach(Obj,(primary_key,table) => updateTblData(table,'primary_key',primary_key)) });
//     if(!_.has(tblData[table],'fields') || _.isEmpty(tblData[table].fields))
//         getTableFields(table).then(function(Obj){ _.forEach(Obj,(fields,table) => updateTblData(table,'fields',fields)) });
//     addToProcessQueue(timeNow,[table,'up']); addToProcessQueue(timeNow,[table,'down']);
// }





// function updateTblData(table,property,value){
//     if(!_.has(tblData,table)) tblData[table] = new Object({});
//     if(!_.has(tblData[table],property)) tblData[table][property] = null;
//     tblData[table][property] = value; saveTblData();
// }

// function saveTblData(){
//     fs.writeFile(syncFile,JSON.stringify(tblData),function(error){
//         if(!error) return; doContinue = false;
//         log('Error in saving sync info file!!');
//     });
// }

// function loadTblData(callback){
//     fs.access(syncFile,function(error){
//         if(error) return callback.call(callback);
//         fs.readFile(syncFile,function(error,data){
//             if(!error) tblData = JSON.parse(data.toString());
//             callback.call(callback);
//         })
//     });
// }

// function getTimeNow(){ return parseInt((new Date().getTime()/1000).toString().substr(4)); }
// function addToProcessQueue(no,data){ return processQueue.hasOwnProperty(no) ? addToProcessQueue(++no,data) : putProcessQueue(no,data); }
// function haveQueueEarlierThan(num){ let first = _.head(_.keys(processQueue)); return !!(first && parseInt(first) <= parseInt(num)); }
// function pullFirstFromQueue(){ let first = _.head(_.keys(processQueue)), data = null; if(first) data = processQueue[first]; delete processQueue[first]; removeQueueDisplay(first); return data; }
// function putProcessQueue(no,data){ processQueue[no] = data; displayProcessQueue(); }
// function displayProcessQueue(){ let queueDiv = $('#queue'); $('.queue-item',queueDiv).remove(); _.forEach(processQueue,(data,id) => { queueDiv.append(getQueueItem(data[0],data[1],id)); }); }
// function getQueueItem(text,direction,id){ return $('<a>').addClass(['queue-item',direction,id]).text(text); }
// function removeQueueDisplay(no){ $('.queue-item.'+no).slideUp(function(){ this.remove() }); }

// function doProcessQueue(){
//     let timeNow = getTimeNow(); workDependentChanges();
//     if(!doContinue || inWork || !haveQueueEarlierThan(timeNow)) return;
//     let data = pullFirstFromQueue(); if(!data) return;
//     inWork = true; updateWorking(); setWorkingDisplay(data[0],data[1]);
//     processTable(data[0],data[1]);
// }
// function downSync(table){
//     let ajaxConfig = _.assign({ context:{ table } },getActivityUploadConfig(table));
//     $.ajax(ajaxConfig).done(function(response){
//         if(response && response.length) handlePostActivityUploadResponse(response,function(Activities){
//             return reQueueSyncForTable(_.head(Activities).table,'down');
//         }); else return reQueueSyncForTable(this.table,'down');
//     }).fail(function(xhr,statusText){
//         log('ERROR while downloading activity :: ' + statusText + '. Skipping ' + this.table);
//         return reQueueSyncForTable(this.table,'down');
//     })
// }

// async function upSync(table,callback){
//     let detail = tblData[table], Activity = [], { created,updated,primary_key } = detail;
//     if(isOneTimeTable(detail)){
//         await getActivity(table,'update_or_create',primary_key,getSyncAllQuery(table))
//             .then((activity)=>{
//                 if(activity && Activity.push(activity) && !_.isEmpty(Activity)) return uploadActivityData(table,Activity,postActivityUpload);
//                 log('No new data to sync for, ' + table); inWork = false;
//             })
//             .catch((errorText)=>{ log(errorText); inWork = false; });
//         if(callback) callback.call();
//     } else {
//         await getActivity(table,'create',primary_key,created ? getSyncCreatedQuery(table,created) : getSyncAllQuery(table))
//             .then((activity)=>{
//                 if(activity) Activity.push(activity);
//                 if(updated){
//                     getActivity(table,'update',primary_key,getSyncUpdatedQuery(table,created,updated))
//                         .then((activity)=>{ if(activity && Activity.push(activity) && !_.isEmpty(Activity)) return uploadActivityData(table,Activity,postActivityUpload); log('No new updates to sync for, ' + table); return reQueueSyncForTable(table,'to'); })
//                         .catch((errorText)=>{ log(errorText); if(!_.isEmpty(Activity)) return uploadActivityData(table,Activity,postActivityUpload); log('No new updates to sync for, ' + table); return reQueueSyncForTable(table,'to'); });
//                 } else {
//                     if(!_.isEmpty(Activity)) return uploadActivityData(table,Activity,postActivityUpload);
//                     log('No new data to sync for, ' + table); return reQueueSyncForTable(table,'to');
//                 }
//             })
//             .catch((errorText)=>{ log(errorText); reQueueSyncForTable(table,'to'); });
//         if(callback) callback.call();
//     }
// }
// function isOneTimeTable( { fields } ){
//     return (!_.includes(fields,'CREATED_DATE') && !_.includes(fields,'MODIFIED_DATE'))
// }
// async function doExecuteQuery(Query){
//     return await new Promise((resolve,reject)=>{
//         mysql.query(Query,(error,results) => {
//             if(error) reject(error);
//             resolve(JSON.parse(JSON.stringify(results)))
//         });
//     });
// }
// async function isRecordExists(table,where){
//     let sql = mysql.format('SELECT * FROM ?? WHERE ?',[table,where]);
//     let results = await doExecuteQuery(sql);
//     return !!results.length;
// }
// async function doInsertRecord(table, primary){
//     let sql = mysql.format('INSERT INTO ?? SET ?',[table,primary]);
//     console.log(sql);
//     // return await doExecuteQuery(sql);
// }
// async function doUpdateRecord(table, record, primary){
//     let sql = mysql.format('UPDATE ?? SET ? WHERE ?',[table,record,primary]);
//     console.log(sql);
//     // return await doExecuteQuery(sql);
// }
// function executeQuery(table,Query){
//     return new Promise(function(resolve,reject){
//         mysql.query(Query,(error,result)=>{
//             if(error) return reject('Error in executing query for Table: ' + table);
//             let pureResult = JSON.parse(JSON.stringify(result));
//             if(!pureResult.length || _.isEmpty(pureResult)) return reject('No new records for Table: ' + table);
//             return resolve(_.zipObject([table],[pureResult]));
//         })
//     });
// }
// function getActivity(table,mode,primary_key,Query) {
//     return new Promise(function(resolve,reject){
//         executeQuery(table,Query)
//             .then((Obj)=>{
//                 if(_.isEmpty(Obj)) return reject('No new records for Table: ' + table);
//                 let objTable = _.head(_.keys(Obj)), data = Obj[objTable];
//                 return resolve({ table:objTable,mode,primary_key,data });
//             })
//             .catch((errorText)=>{ return reject(errorText); })
//     })
// }
// function uploadActivityData(table,activity,callback){
//     if(!activity || _.isEmpty(activity)) return inWork = false;
//     let context = { table,activity,callback }, data = getFormData(table,activity), ajaxConfig = getActivityUploadConfig(table),
//         config = _.assign({ data,context },ajaxConfig);
//     log('Uploading new sync activities for, ' + table);
//     $.ajax(config).done(function(response){
//         let { table,activity,callback } = this;
//         callback.apply(callback,[response,table,activity]);
//     }).fail(function(xhr,statusText){
//         log('ERROR while uploading activity :: ' + statusText + '. Skipping ' + this.table);
//         console.log(this.activity); return reQueueSyncForTable(this.table,'to');
//     })
// }
// function getFormData(table,data){ let form_data = new FormData(); form_data.append('file',new Blob([JSON.stringify(data)],{ type:'application/json' }),[table,'json'].join('.')); return form_data; }
// function getActivityUploadConfig(table){ return { url:path.join(ssConfig.url_interact,'sync',client,table),type:'post',enctype:'multipart/form-data',processData:false,contentType:false } }
// function postActivityUpload(response,table,Activity){
//     if(response && response.length) handlePostActivityUploadResponse(response);
//     let latest_update = null, latest_create = null;
//     _.forEach(Activity,(activity) => {
//         activityUpwardCompleteLog(activity);
//         if(activity.mode !== 'update_or_create'){
//             latest_create = _.max([getMaxOfDateField(activity.data,'MODIFIED_DATE'),latest_create]);
//             latest_update = _.max([getMaxOfDateField(activity.data,'CREATED_DATE'),latest_update]);
//         }
//     });
//     updateTableDates(table,latest_create,latest_update);
// }
// function activityUpwardCompleteLog(activity){
//     let { table,mode } = activity, records = activity.data.length;
//     log(table + ' -> ' + mode + ' -> ' + records + ' records');
// }
// function getMaxOfDateField(collection,field){
//     let dateObject = _.mapKeys(_.map(collection,field),dText => new Date(dText).getTime());
//     return _.get(dateObject,_.max(_.keys(dateObject)))
// }
// function updateTableDates(table, latest_create, latest_update){
//     let id = tblData[table].id, url = getSyncTableSetUrl(id), data = { create:null,update:null };
//     if(latest_update) data.update = latest_update; if(latest_create) data.create = latest_create;
//     log('Sending last synced time for, ' + table);
//     $.getJSON(url,data,function (response){
//         let { table, last_created, last_updated } = response;
//         updateTblData(table,'created',last_created);
//         updateTblData(table,'updated',last_updated);
//         log('Times updated locally and on server for, ' + table);
//         return reQueueSyncForTable(table,'to');
//     }).fail(function(xhr,statusText){
//         log('ERROR while setting time :: ' + statusText + '. Skipping ' + this.table);
//         return reQueueSyncForTable(table,'to');
//     });
// }
// function getSyncTableSetUrl(id){
//     return url.format({ protocol,hostname,pathname:pathname.replace('{id}',id) })
// }
// function reQueueSyncForTable(table,direction){
//     let delay = parseInt(tblData[table][direction]); if(!delay || isOneTimeTable(tblData[table])) return inWork = false;
//     if(!inQueue(table,directionMap[direction])) addToProcessQueue(delay + getTimeNow(),[table,directionMap[direction]]);
//     log('Table: ' + table + ', added to Queue'); return inWork = false;
// }
// function inQueue(table,direction){ return _.some(processQueue,(arr)=>(arr[0] === table && arr[1] === direction)); }

// function handlePostActivityUploadResponse(response,callback){
//     let jsonResponse = JSON.parse(response); if(!jsonResponse || _.isEmpty(jsonResponse)) return;
//     upSync(_.head(jsonResponse).table,function(){
//         _.forEach(jsonResponse,function(activity){
//             if(_.isEmpty(activity.data)) return;
//             let { table,data,mode } = activity; let { primary_key } = tblData[table];
//             log('Received some updates while uploading'); log([table,mode,data.length,'records'].join(' -> '));
//             _.forEach(data,function(record){
//                 let primary = _.pick(record,primary_key);
//                 if(isRecordExists(table,primary)) doInsertRecord(table,record);
//                 else doUpdateRecord(table,record,primary);
//             })
//         });
//         if(callback) callback.call(null,jsonResponse)
//     });
// }







// function updateWorking(){ clearTimeout(workTimeOut); $('.app-title').addClass('working'); workTimeOut = setTimeout(function(){ $('.app-title').removeClass('working'); },continueInterval); }
// function setWorkingDisplay(text,dir){ let opDir = { up:'down',down:'up','':['up','down'] }; $('.queue-working').text(text).addClass(dir).removeClass(opDir[dir]); }
// function log(text) { $('<pre>').text(`${(new Date().getTime()).toString().substr(7)} :: ${text}`).slideUp().prependTo('#log').slideDown(200).parent('#log').children(`:gt(${maxLog})`).remove(); }
// function send(channel,args){ ipcRenderer.send.apply(null,[channel,args]) }
// function quitApp(){ dialog.showMessageBox(quitConfirmOptions,(index) => { if(index) send('quit-app'); }) }
// function alterContinue(){ doContinue = !doContinue; $('#alter_continue').text((doContinue?'Pause':'Continue') + ' Sync') }
// function minimizeToTray(){ send('minimize-to-tray'); }
// function workDependentChanges(){
//     $('#minimize_tray')[doContinue?'removeClass':'addClass']('d-none');
//     if(!inWork) {
//         $('#alter_continue').prop('disabled',false);
//         $('#quit_app')[doContinue?'addClass':'removeClass']('d-none');
//         setWorkingDisplay('','');
//     }
// }



// function getTableFields(table){
//     return new Promise(function(resolve,reject){
//         mysql.query('SELECT * FROM ?? LIMIT 1',table,function(error, result, fieldPackets){
//             if(error) return reject(`Error while trying to get field from table: ${table}`);
//             return resolve(_.zipObject([table],[getFieldArrayFromFieldPackets(fieldPackets)]))
//         })
//     })
// }
// function getTablePrimaryFields(table){
//     return new Promise(function(resolve,reject){
//         mysql.query('SHOW CREATE TABLE ??',table,function(error,result){
//             let CreateTable = _.get(_.head(result),'Create Table'), pattern = new RegExp(/PRIMARY KEY \(`(.*)`\)/), split = '`,`';
//             if(error) return reject(`Error while trying to get primary fields from table: ${table}`);
//             return resolve(_.zipObject([table],[pattern.exec(CreateTable)[1].split(split)]));
//         });
//     })
// }
// function getFieldArrayFromFieldPackets(fieldPackets){ return _.map(fieldPackets,'name'); }
// function getSyncCreatedQuery(table,created){
//     return mysql.format("SELECT * FROM ?? WHERE ?? > ? ORDER BY ?? ASC",[table,'CREATED_DATE',created,'CREATED_DATE']);
// }
// function getSyncUpdatedQuery(table,created,updated){
//     return mysql.format("SELECT * FROM ?? WHERE ?? > ? AND ?? <= ? ORDER BY ?? ASC",[table,'MODIFIED_DATE',updated,'CREATED_DATE',created,'MODIFIED_DATE']);
// }
// function getSyncAllQuery(table){
//     return mysql.format("SELECT * FROM ??",[table]);
// }
