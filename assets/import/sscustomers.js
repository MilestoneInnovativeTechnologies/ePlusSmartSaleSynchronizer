const db = require('mysql'), _ = require('lodash'), FNCODE = 'ACMAS02';
const countryCurrencyZone = 'SELECT B.COUNTRY,B.ZONECODE,C.CURRENCYCODE CURRENCY FROM branchmaster B,companydetails C WHERE B.COCODE = C.CODE AND B.CODE = ? AND C.CODE = ?';
const multiBranch = 'SELECT MULTIBRANCH FROM SETUP WHERE CODE = "01"';
const argQuery = ["SELECT ARGUMENTS FROM `FUNCTION` WHERE CODE = ?","SELECT ARGUMENTS FROM BRANCHFUNCTION WHERE FNCODE = ? AND BRCODE = ? AND COCODE = ?"]
const nextAccountCode = "SELECT NEXTACCOUNTCODE(?,?) NEXTACCCODE";
const insFormat1 = "INSERT INTO `accountmaster` (??) VALUES (?)";
const insFormat2 = 'INSERT INTO `accountdetails` (??) VALUES ?';
const insFormat3 = "INSERT INTO `areaaccount` (??) VALUES (?)";
let mysql, tblData, mainActivity, processingRecords, MULTI = false;

function main(Activity,TblData,mysqlParams){
    mysql = db.createConnection(mysqlParams); mysql.connect(); tblData = TblData;
    mainActivity = Activity;
    init()
        .then(() => processActivity(0).then(nextCall))
        .catch(error => {
            log('Failed Initialize..');
            endWithMaxDate();
        })
}

function endWithMaxDate(){
    return end(mainActivity.datetime);
}

function init(){
    return new Promise(function (resolve,reject){
        mysql.query(multiBranch,(error,rowPackets) => {
            if(error) { logDBError(error); reject(error); }
            let mBranch = rowPackets[0].MULTIBRANCH;
            MULTI = (mBranch === 'Yes');
            resolve(true)
        })
    })
}

function nextCall({ method,args }){
    method.apply(null,args).then(nextCall)
}

async function processActivity(idx){
    if(!mainActivity[idx]) return Promise.resolve({ method:endWithMaxDate, args:[] });
    let nIdx = idx+1, records = mainActivity[idx].data;
    if(!records.length) return Promise.resolve({ method:processActivity, args:[nIdx] });
    processingRecords = records;
    return Promise.resolve({ method:processRecord,args:[nIdx,0]})
}

async function processRecord(mActIdx,rIdx){
    let nRIdx = rIdx+1, nextCall = [{ method:processActivity,args:[mActIdx] },{ method:processRecord,args:[mActIdx,nRIdx] }];
    let record = processingRecords[rIdx]; if(!record) return Promise.resolve(nextCall[0]);
    let { DISPLAYNAME, AREACODE, BRCODE, COCODE } = record;

    if(!DISPLAYNAME) { log('No Name.. Insert Aborted'); return Promise.resolve(nextCall[1]); } log(DISPLAYNAME);
    if(!AREACODE) { log('No Area.. Insert Aborted'); return Promise.resolve(nextCall[1]); }

    let PCODE = await parentCode(BRCODE,COCODE); if(PCODE === false) { log('PCODE Null.. Insert Aborted'); return Promise.resolve(nextCall[1]); }
    let CODE = await nextAccCode(PCODE,DISPLAYNAME); if(!CODE) { log('CODE Null.. Insert Aborted'); return Promise.resolve(nextCall[1]); }

    let masterStatus = await masterInsert(CODE,DISPLAYNAME,PCODE); if(!masterStatus){ log('Master Failed!'); cache([record]); return Promise.resolve(nextCall[1]); }
    log('Master Inserted..');

    let CCZ = await getCountryCurrencyZone(BRCODE,COCODE); if(!CCZ){ log('CNT-CUR-ZNE Failed!'); return Promise.resolve(nextCall[1]); }
    let insData = _.pick(record,['DISPLAYNAME','ADDRESS','PHONE','EMAIL']);
    insData = _.assign({},insData,CCZ,{ CODE })
    let detailStatus = await detailInsert(insData); if(!detailStatus){ log('Detail Failed!'); return Promise.resolve(nextCall[1]); }
    log('Detail Inserted..');

    let areaStatus = await areaInsert(AREACODE,CODE);
    if(!areaStatus) log('Area Failed!'); else log('Area   Inserted..');
    return Promise.resolve(nextCall[1]);
}

function parentCode(BRCODE,COCODE){
    return new Promise(function(resolve){
        mysql.query(argQuery[_.toSafeInteger(MULTI)],[FNCODE,BRCODE,COCODE],(error,rowPackets) => {
            if(!error) return resolve(rowPackets[0].ARGUMENTS.split('|')[0]);
            logDBError(error); return resolve(false)
        })
    })
}

function nextAccCode(PCODE,NAME){
    return new Promise(function (resolve){
        mysql.query(nextAccountCode,[PCODE,NAME],function(error,rowPackets){
            if(error) { logDBError(error); return resolve(false); }
            let CODE = rowPackets[0].NEXTACCCODE;
            if(!CODE) return resolve(false);
            return resolve(CODE);
        })
    })
}

function getCountryCurrencyZone(BRCODE,COCODE){
    return new Promise(function (resolve){
        mysql.query(countryCurrencyZone,[BRCODE,COCODE],function(error,rowPackets){
            if(error) { logDBError(error); return resolve(false); }
            let COUNTRY = rowPackets[0].COUNTRY || 'IN';
            let CURRENCY = rowPackets[0].CURRENCY || 'INR';
            let ZONECODE = rowPackets[0].ZONECODE || '';
            return resolve({ COUNTRY,CURRENCY,ZONECODE })
        })
    })
}

function masterInsert(CODE,NAME,PCODE){
    return new Promise(function (resolve){
        mysql.query(insFormat1,[['CODE','NAME','PCODE'],[CODE,NAME,PCODE]],function (error){
            if(!error) return resolve(true);
            logDBError(error); resolve(false);
        })
    })
}

function detailInsert(data){
    let { names,values } = getFormattedVariables([data]);
    return new Promise(function (resolve){
        mysql.query(insFormat2,[names,values],function (error) {
            if(!error) return resolve(true);
            logDBError(error); resolve(false);
        })
    })
}

function areaInsert(AREACODE,CODE){
    return new Promise(function (resolve){
        mysql.query(insFormat3,[['AREACODE','ACCCODE'],[AREACODE,CODE]],function (error) {
            if(!error) return resolve(true);
            logDBError(error); resolve(false);
        })
    })
}

function getFormattedVariables(records) {
    let names = Object.keys(_.head(records));
    let values = _.map(records,record => getNamesValues(names,record));
    return { names,values }
}

function getNamesValues(names,record){
    let values = [];
    for(let i in names) values[i] = record[names[i]] || '';
    return values;
}