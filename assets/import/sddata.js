const db = require('mysql'), _ = require('lodash');
const insFormat = 'INSERT INTO `sddata` (??) VALUES ?';
const ShiftSPFormat = 'CALL SP_SHIFTADDTRANSACTION(?,?,?,?,?,?,?)';
const ShiftSPCallKeys = ['COCODE','BRCODE','FYCODE','FNCODE','DOCNO','CASH','REFFNCODE'];
const mDateQuery = 'SELECT MAX(CREATED_DATE) mDate FROM `sddata`';
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
    insertData(records)
        .catch(() => cache(records))
        .finally(() => doProcessActivity(nIdx))
    ;
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

function getInsertRecord(Ary) { return _.map(Ary,record => _.pick(record,tblData.fields)); }

function getShiftSPArgs(record) { return _.map(ShiftSPCallKeys,key => _.get(record,key,key)); }

function getFormattedVariables(records) {
    let names = Object.keys(_.head(records));
    let values = _.map(records,record => Object.values(record));
    return { names,values }
}
