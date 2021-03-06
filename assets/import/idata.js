const db = require('mysql'), _ = require('lodash');
const insFormat = 'INSERT INTO `idata` (??) VALUES ?';
const updFormat = 'UPDATE `idata` SET ? WHERE ';
const SPCallFormat = 'CALL SP_ACCOUNTPOSTING (?,?,?,?,?)';
const SPMT1CallFormat = 'CALL SP_UPDATEWORKFLOW (?,?,?,?,?,?,?,?,?,?,?)';
const ShiftSPCall = 'CALL SP_UPDATESHIFTINFO(?,?,?,?,?,?,?,?,?,?)';
const mDateQuery = 'SELECT MAX(CREATED_DATE) mDate FROM `idata`';
let mysql, tblData;
function main(Activity,TblData,mysqlParams){
    mysql = db.createConnection(mysqlParams); mysql.connect(); tblData = TblData;
    _.forEach(Activity,processActivity);
}
function endWithMaxDate(){
    mysql.query(mDateQuery,function(error,rowsPackets){
        if(error) logDBError(error);
        else mDate = JSON.parse(JSON.stringify(rowsPackets))[0].mDate;
        return end(mDate || null);
    })
}

let data;
let companies, branches, fycodes, fncodes, docnos;

function processActivity(activity){ if(_.isArray(activity)) return processActivity(activity[0])
    if(!activity || !activity.data || !activity.data.length) return endWithMaxDate();
    data = getGroupedRecords(activity.data);
    companies = Object.keys(data);
    processCompany(0)
}

function getGroupedRecords(records) {
    let cGroup = _.groupBy(records,'COCODE');
    let cbGroup = _.mapValues(cGroup,(Ary) => _.groupBy(Ary,'BRCODE'));
    let cbyGroup =  _.mapValues(cbGroup,(cGroup) => _.mapValues(cGroup,Ary => _.groupBy(Ary,'FYCODE')));
    let cbyfGroup =  _.mapValues(cbyGroup,(cbGroup) => _.mapValues(cbGroup,(cGroup) => _.mapValues(cGroup,Ary => _.groupBy(Ary,'FNCODE'))));
    let cbyfdGroup = _.mapValues(cbyfGroup,(cbyGroup) => _.mapValues(cbyGroup,(cbGroup) => _.mapValues(cbGroup,(cGroup) => _.mapValues(cGroup,Ary => _.groupBy(Ary,'DOCNO')))));
    return cbyfdGroup;
}

// noinspection DuplicatedCode
function processCompany(cmpIdx){
    if(!companies || !companies[cmpIdx]) return endWithMaxDate();
    branches = Object.keys(data[companies[cmpIdx]]);
    processCompanyBranch(cmpIdx,0)
}

function processCompanyBranch(cmpIdx,brnIdx) {
    let cmp = companies[cmpIdx];
    if(!data[cmp] || !data[cmp][branches[brnIdx]]) return processCompany(cmpIdx+1);
    fycodes = Object.keys(data[cmp][branches[brnIdx]]);
    processCompanyBranchYear(cmpIdx,brnIdx,0)
}

function processCompanyBranchYear(cmpIdx,brnIdx,fynIdx) {
    let cmp = companies[cmpIdx], brn = branches[brnIdx];
    if(!data[cmp][brn] || !data[cmp][brn][fycodes[fynIdx]]) return processCompanyBranch(cmpIdx,brnIdx+1);
    fncodes = Object.keys(data[cmp][brn][fycodes[fynIdx]]);
    processCompanyBranchYearFn(cmpIdx,brnIdx,fynIdx,0);
}

function processCompanyBranchYearFn(cmpIdx,brnIdx,fynIdx,fncIdx) {
    let cmp = companies[cmpIdx], brn = branches[brnIdx], fyc = fycodes[fynIdx];
    if(!data[cmp][brn][fyc] || !data[cmp][brn][fyc][fncodes[fncIdx]]) return processCompanyBranchYear(cmpIdx,brnIdx,fynIdx+1);
    docnos = Object.keys(data[cmp][brn][fyc][fncodes[fncIdx]]);
    processCompanyBranchYearFnDoc(cmpIdx,brnIdx,fynIdx,fncIdx,0);
}

function processCompanyBranchYearFnDoc(cmpIdx, brnIdx, fynIdx, fncIdx, docIdx) {
    let cmp = companies[cmpIdx], brn = branches[brnIdx], fyc = fycodes[fynIdx], fnc = fncodes[fncIdx];
    if(!data[cmp][brn][fyc][fnc] || !data[cmp][brn][fyc][fnc][docnos[docIdx]]) return processCompanyBranchYearFn(cmpIdx,brnIdx,fynIdx,fncIdx+1);
    let records = data[cmp][brn][fyc][fnc][docnos[docIdx]], nyDocIdx = docIdx+1;
    processData(cmpIdx, brnIdx, fynIdx, fncIdx, docIdx, records)
        .finally(() => processCompanyBranchYearFnDoc(cmpIdx, brnIdx, fynIdx, fncIdx, nyDocIdx));
}

async function processData(cmpIdx, brnIdx, fynIdx, fncIdx, docIdx, records) {
    let cmp = companies[cmpIdx], brn = branches[brnIdx], fyc = fycodes[fynIdx], fnc = fncodes[fncIdx], doc = docnos[docIdx], sDoc = _.get(records,[0,'SHFDOCNO'],null);
    let ref = _.pick(records[0],['REFCOCODE','REFBRCODE','REFFYCODE','REFFNCODE','REFDOCNO']);
    let { insert,update } = await sepInsUpdRecords(records);
    return new Promise((resolve, reject) => {
        Promise.all([insertData(insert),updateRecords(update)]).then(() => {
            RunSP(cmp,brn,fyc,fnc,doc,sDoc)
                .then(() => RunMT1SP(ref.REFCOCODE,ref.REFBRCODE,ref.REFFYCODE,ref.REFFNCODE,ref.REFDOCNO,'Approved',cmp,brn,fyc,fnc,doc).then(res => resolve([cmp,brn,fyc,fnc,doc])))
                .catch(() => reject([cmp,brn,fyc,fnc,doc]));
        }).catch(() => reject(cache(records)))
    })
}

function insertData(records) {
    if(_.isEmpty(records)) return Promise.resolve(true);
    let insRecords = getInsertRecord(records);
    let { names,values } = getFormattedVariables(insRecords);
    return new Promise(((resolve, reject) => {
        mysql.query(insFormat,[names,values],function (error) {
            if(error) logDBError(error);
            log(error ? 'Failed Insert' : 'Inserted '+values.length);
            return (error && error.sqlMessage.substr(0,15) !== 'Duplicate entry') ? reject(error) : resolve(true)
        })
    }))
}

async function updateRecords(records) {
    if(_.isEmpty(records)) return Promise.resolve(true);
    records = getInsertRecord(records);
    for(let i in records){
        let record = records[i];
        await updateRecord(record)
    }
    return Promise.resolve(true);
}

function updateRecord(record){
    return new Promise(((resolve,reject) => {
        mysql.query(mysql.format(updFormat,[record]) + getWhereString(record),function(error){
            return error ? reject(logDBError(error) || false) : resolve(true)
        })
    }))
}

function RunSP(cmp,brn,fyc,fnc,doc,sDoc) {
    return new Promise((resolve, reject) => {
        mysql.query(SPCallFormat,[cmp,brn,fyc,fnc,doc],function(error){
            if(error) { logDBError(error); log('Failed Calling SP'); return reject(error); }
            if(sDoc) mysql.query(ShiftSPCall,getShiftSPArgs(cmp,brn,fyc,fnc,doc,sDoc),function(){ log('Shift SP Executed'); });
            resolve(true);
        })
    })
}

function RunMT1SP(...args) {
    if(args[3] !== 'MT2' || !args[4] || _.filter(args).length !== 11) return Promise.resolve(true);
    return new Promise((resolve, reject) => {
        mysql.query(SPMT1CallFormat,args,function(error){
            if(error) { logDBError(error); log('Failed Calling MT SP'); return reject(error); }
            log('MT SP Executed!!'); resolve(true);
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

function getShiftSPArgs(cmp,brn,fyc,fnc,doc,sDoc) {
    return [cmp,brn,fyc,fnc,doc,cmp,brn,fyc,'SHF',sDoc];
}

function isDataExists(record){
    return new Promise(function(resolve){
        mysql.query(mysql.format("SELECT * FROM ?? WHERE ",['idata']) + getWhereString(record),function(error,rows){
            if(!error && rows && rows.length > 0) resolve(true)
            else resolve(false);
        })
    });
}

function getWhereString(record){
    return _(tblData.primary_key).map(key => mysql.format('??=?',[key,record[key]])).value().join(' AND ')
}

async function sepInsUpdRecords(records){
    let insert = [], update = [];
    for(let i in records){
        let record = records[i];
        if(await isDataExists(record)) update.push(record)
        else insert.push(record)
    }
    return { insert,update }
}