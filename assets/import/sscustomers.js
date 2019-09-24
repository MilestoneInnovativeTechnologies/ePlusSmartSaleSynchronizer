const db = require('mysql'), _ = require('lodash');
const FNCODE = 'ACMAS02', COCODE = '01';
const currencyCountry = 'SELECT CURRENCY,COUNTRY FROM `accountdetails` LIMIT 1,1';
const multiBranch = 'SELECT MULTIBRANCH FROM SETUP WHERE CODE = ?';
const singleBranchArgument = "SELECT ARGUMENTS FROM `FUNCTION` WHERE CODE = ?";
const multiBranchArgument = "SELECT BRCODE,ARGUMENTS FROM BRANCHFUNCTION WHERE FNCODE = ? AND COCODE = ?";
const nextAccountCode = "SELECT NEXTACCOUNTCODE(?,?) NEXTACCCODE";
const insFormat1 = "INSERT INTO `accountmaster` (??) VALUES (?)";
const insFormat2 = 'INSERT INTO `accountdetails` (??) VALUES ?';
let mysql, tblData, mainActivity, pCode, processingRecords, CURRENCY, COUNTRY;

function main(Activity,TblData,mysqlParams){
    mysql = db.createConnection(mysqlParams); mysql.connect(); tblData = TblData;
    mainActivity = Activity;
    Promise.all([getParentCode(),setCurrencyAndCountry()]).then((rArray) => {
        pCode = rArray[0];  _.forEach(mainActivity,activity => {
            doProcessActivity(0)
        })
    });
}

function endWithMaxDate(){
    return;
    return end(mainActivity.datetime);
}

function getParentCode() {
    return new Promise(function(resolve){
        mysql.query(multiBranch,[COCODE],(error,rowPackets) => {
            let mBranch = rowPackets[0].MULTIBRANCH, pCode = {};
            if(mBranch === 'Yes'){
                mysql.query(multiBranchArgument,[FNCODE,COCODE],(error,rowPackets) => {
                    _.forEach(rowPackets,(row) => pCode[row.BRCODE] = row.ARGUMENTS.split('|')[0]);
                    resolve(pCode);
                })
            } else {
                mysql.query(singleBranchArgument,[FNCODE],(error,rowPackets) => {
                    pCode['_'] = rowPackets[0].ARGUMENTS.split('|')[0];
                    resolve(pCode);
                })
            }
        })
    })
}
function setCurrencyAndCountry(){
    return new Promise(function(resolve){
        mysql.query(currencyCountry,function(error,rowPackets){
            CURRENCY = rowPackets[0].CURRENCY || 'INR';
            COUNTRY = rowPackets[0].COUNTRY || 'IN';
            resolve(true);
        })
    })
}

function doProcessActivity(idx){
    if(!mainActivity[idx]) return endWithMaxDate();
    let nIdx = idx+1, records = mainActivity[idx].data;
    if(!records.length) return doProcessActivity(nIdx);
    processingRecords = records;
    doProcessRecord(nIdx,0)
}

function doProcessRecord(mActIdx,rIdx){
    let record = processingRecords[rIdx]; if(!record) return doProcessActivity(mActIdx);
    let NAME = record.DISPLAYNAME, nRIdx = rIdx+1;
    let insData = _.pick(record,tblData.fields);
    let PCODE = _.get(pCode,record.BRCODE,_.get(pCode,'_'));
    mysql.query(nextAccountCode,[PCODE,NAME],(error,rowPackets) => {
        let CODE = rowPackets[0].NEXTACCCODE;
        insData = _.assign(insData,{ CODE,CURRENCY,COUNTRY });
        let { names,values } = getFormattedVariables([insData]);
        mysql.query(insFormat1,[['CODE','NAME','PCODE'],[CODE,NAME,PCODE]],function (error) {
            if(error) {
                log('Failed Insert 1'); cache([record]);
                doProcessRecord(mActIdx,nRIdx);
            } else {
                mysql.query(insFormat2,[names,values],function (error) {
                    if(!error) log('Inserted 1');
                    doProcessRecord(mActIdx,nRIdx);
                })
            }
        });
    })
}

function getFormattedVariables(records) {
    let names = Object.keys(_.head(records));
    let values = _.map(records,record => Object.values(record));
    return { names,values }
}