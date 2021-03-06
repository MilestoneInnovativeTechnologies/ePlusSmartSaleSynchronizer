const db = require('mysql'), _ = require('lodash');
const insFormat = 'INSERT INTO `importtransactions` (??) VALUES ?';
const SPCallFormat = 'CALL SP_IMPORTTRANSACTIONS()';
const ShiftSPCall = 'CALL SP_UPDATESHIFTINFO(?,?,?,?,?,?,?,?,?,?)';
const ShiftSPCallKeys = ['COCODE','BRCODE','FYCODE','FNCODE','DOCNO','COCODE','BRCODE','FYCODE','SHF','SHFDOCNO'];
let mysql, tblData, mainActivity;
function main(Activity,TblData,mysqlParams){
    mysql = db.createConnection(mysqlParams); mysql.connect(); tblData = TblData;
    mainActivity = Activity; doProcessActivity(0);
}
function endWithMaxDate(){
    return end(mainActivity.datetime);
}

function doProcessActivity(idx){
    if(!mainActivity[idx]) return endWithMaxDate();
    let nIdx = idx+1, records = mainActivity[idx].data;
    if(!records.length) return doProcessActivity(nIdx);
    insertData(records).then(() => {
        mysql.query(SPCallFormat,function(error){
            if(error) { logDBError(error); log('Failed Calling SP'); return doProcessActivity(nIdx); }
            Promise.all(_.map(records,record => {
                if(!record.SHFDOCNO) return Promise.resolve(true);
                mysql.query(ShiftSPCall,getShiftSPArgs(record));
                return Promise.resolve(true);
            })).finally(() => { doProcessActivity(nIdx); log('SP Executed'); });
        });
    }).catch(() => {
        cache(records); doProcessActivity(nIdx);
    })
}

function insertData(records) {
    let insRecords = getInsertRecord(records);
    let { names,values } = getFormattedVariables(insRecords);
    return new Promise(((resolve, reject) => {
        mysql.query(insFormat,[names,values],function (error) {
            if(error) logDBError(error);
            log(error ? 'Failed Insert' : 'Inserted '+values.length);
            return error ? reject(error) : resolve(true)
        })
    }))
}

function RunSP() {
    return new Promise((resolve, reject) => {
        mysql.query(SPCallFormat,function(error){
            if(error) logDBError(error);
            log(error ? 'Failed Calling SP' : 'SP Executed');
            return error ? reject(error) : resolve(true)
        })
    })
}

function getInsertRecord(Ary) {
    return _.map(Ary,record => _.pick(record,tblData.fields))
}

function getFormattedVariables(records) {
    let names = Object.keys(_.head(records));
    let values = _.map(records,record => Object.values(record));
    return { names,values }
}

function getShiftSPArgs(record) {
    return _.map(ShiftSPCallKeys,key => _.get(record,key,key));
}