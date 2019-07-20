const db = require('mysql'), _ = require('lodash');
const insFormat = 'INSERT INTO `importsales` (??) VALUES ?';
const SPCallFormat = 'CALL SP_IMPORTSALES (?,?,?)';
const TruncateFormat = 'TRUNCATE `importsales`';
let mysql, tblData;
function main(Activity,TblData,mysqlParams){
    mysql = db.createConnection(mysqlParams); mysql.connect(); tblData = TblData;
    mysql.query(TruncateFormat,() => _.forEach(Activity,processActivity))
}

let data;
let companies, branches, fycodes;

function processActivity(activity){
    let records = activity.data; if(!records.length) return;
    data = getGroupedRecords(records);
    companies = Object.keys(data);
    processCompany(0)
}

function getGroupedRecords(records) {
    let cGroup = _.groupBy(records,'COCODE');
    let cbGroup = _.mapValues(cGroup,(Ary) => _.groupBy(Ary,'BRCODE'));
    return _.mapValues(cbGroup,(cGroup) => _.mapValues(cGroup,Ary => _.groupBy(Ary,'FYCODE')));
}

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
    let fyc = fycodes[fynIdx], records = data[cmp][brn][fyc], nFynIdx = fynIdx+1;
    insertData(records).then(() => {
        RunSP(cmp,brn,fyc)
            .then(() => processCompanyBranchYear(cmpIdx,brnIdx,nFynIdx))
            .catch(() => processCompanyBranchYear(cmpIdx,brnIdx,nFynIdx));
    }).catch(() => processCompanyBranchYear(cmpIdx,brnIdx,nFynIdx))
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

function RunSP(COCODE, BRCODE, FYCODE) {
    return new Promise((resolve, reject) => {
        mysql.query(SPCallFormat,[COCODE,BRCODE,FYCODE],function(error){
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