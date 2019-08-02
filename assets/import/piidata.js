const db = require('mysql'), _ = require('lodash');
const insFormat = 'INSERT INTO `piidata` (??) VALUES ?';
// const SPCallFormat = 'CALL SP_ACCOUNTPOSTING (?,?,?,?,?)';
// const TruncateFormat = 'TRUNCATE `idata`';
let mysql, tblData;
function main(Activity,TblData,mysqlParams){
    mysql = db.createConnection(mysqlParams); mysql.connect(); tblData = TblData;
    _.forEach(Activity,processActivity);
    // mysql.query(TruncateFormat,() => _.forEach(Activity,processActivity))
}

let data;
let companies, branches, fycodes, fncodes, docnos;

function processActivity(activity){
    let records = activity.data; if(!records.length) return;
    data = getGroupedRecords(records);
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
    if(!companies || !companies[cmpIdx]) return end();
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
        .then(() => processCompanyBranchYearFnDoc(cmpIdx, brnIdx, fynIdx, fncIdx, nyDocIdx))
        .catch(() => processCompanyBranchYearFnDoc(cmpIdx, brnIdx, fynIdx, fncIdx, nyDocIdx));
}

function processData(cmpIdx, brnIdx, fynIdx, fncIdx, docIdx, records) {
    let cmp = companies[cmpIdx], brn = branches[brnIdx], fyc = fycodes[fynIdx], fnc = fncodes[fncIdx], doc = docnos[docIdx];
    return new Promise((resolve, reject) => {
        insertData(records).then(() => {
            RunSP(cmp,brn,fyc,fnc,doc)
                .then(() => resolve([cmp,brn,fyc,fnc,doc]))
                .catch(() => reject([cmp,brn,fyc,fnc,doc]));
        }).catch(() => reject(records))
    })
}

function insertData(records) {
    let insRecords = getInsertRecord(records);
    let { names,values } = getFormattedVariables(insRecords);
    return new Promise(((resolve, reject) => {
        mysql.query(insFormat,[names,values],function (error) {
            log(error ? 'Failed Insert' : 'Inserted '+values.length);
            return error ? reject(error) : resolve(true)
        })
    }))
}

function RunSP(...SPArgs) {
    return new Promise((resolve, reject) => {
        // mysql.query(SPCallFormat,SPArgs,function(error){
        //     log(error ? 'Failed Calling SP' : 'SP Executed');
        //     return error ? reject(error) : resolve(true)
        // })
        resolve(true);
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