const db = require('mysql'), _ = require('lodash');
const insFormat = 'INSERT INTO `shdata` (??) VALUES ?';
const updFormat = 'UPDATE `shdata` SET ? WHERE COCODE = ? AND BRCODE = ? AND FYCODE = ? AND FNCODE = ? AND DOCNO = ?';
const CloseShiftSPFormat = 'CALL SP_SHIFTJVPOSTING(?,?,?,?,?)';
const ShiftSPCallKeys = ['COCODE','BRCODE','FYCODE','FNCODE','DOCNO'];
const mDateQuery = 'SELECT MAX(CREATED_DATE) mDate FROM `shdata`';
let mysql, tblData, mainActivity;
function main(Activity,TblData,mysqlParams){
    mysql = db.createConnection(mysqlParams); mysql.connect(); tblData = TblData;
    mainActivity = Activity; doProcessActivity(0);
}
function endWithMaxDate(){
    mysql.query(mDateQuery,function(error,rowsPackets){
        if(error) logDBError(error);
        else mDate = JSON.parse(JSON.stringify(rowsPackets))[0].mDate;
        return end(mDate || null);
    })
}

function doProcessActivity(idx){
    if(!mainActivity[idx]) return endWithMaxDate();
    let nIdx = idx+1, records = mainActivity[idx].data;
    if(!records || !records.length) return doProcessActivity(nIdx);
    if(mainActivity[idx].mode === 'update'){
        updateData(records)
            .then(() => log('Updated '+records.length))
            //.catch(() => cache(records))
            .finally(() => doProcessActivity(nIdx))
    } else {
        insertData(records)
            .then(() => doProcessActivity(nIdx))
            .catch(() => { cache(records); doProcessActivity(nIdx); });
    }
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

function updateData(records) {
    return new Promise((resolve,reject) => {
        Promise.all(_.map(records,record => {
            let updRecord = getUpdateRecord(record), condition = getUpdateCondition(record);
            mysql.query(updFormat,[].concat(updRecord).concat(condition),function(error){
                if(error){ logDBError(error); log('Failed Update'); return; }
                mysql.query(CloseShiftSPFormat,getShiftSPArgs(record))
            });
            return Promise.resolve(true);
        }))
            .then(() => resolve(true))
            .catch(() => reject(true))
        ;
    })
}

function getInsertRecord(Ary) { return _.map(Ary,record => _.pick(record,tblData.fields)); }
function getUpdateRecord(record) { return _(record).omit(tblData.primary_key).pick(tblData.fields).value(); }
function getUpdateCondition(record) { return ShiftSPCallKeys.map(key => _.get(record,key)) }
function getShiftSPArgs(record) { return _.map(ShiftSPCallKeys,key => _.get(record,key,key)); }

function getFormattedVariables(records) {
    let names = Object.keys(_.head(records));
    let values = _.map(records,record => Object.values(record));
    return { names,values }
}
