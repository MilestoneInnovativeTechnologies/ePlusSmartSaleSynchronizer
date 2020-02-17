class LDCQuery {
    constructor(table,data) {
        ['type','sync','delay','fields']
            .forEach(key => this[key] = data[key]);
        this.table = table; this.delay = parseInt(this.delay);
        this.condition = new SQLCondition(data).get() || '';
    }
    prepare(){
        if(this.type === 'down' || !this.delay) return null;
        let conditionalFields = this.getConditionFields(this.fields);
        if(!conditionalFields.length) return null;
        return `SELECT ${this.getSelectFields(conditionalFields,this.sync).join(', ')}`
    }
    getConditionFields(fields){
        const checks = ['CREATED_DATE','MODIFIED_DATE'];
        return _(checks).map(field => _.includes(fields,field) ? field : null).filter().value();
    }
    getSelectFields(fields,sync){
        let sFields = [], condition = this.condition;
        sFields.push(this.getSelectQueryTable(),this.getSelectQueryCreated(fields,sync,condition),this.getSelectQueryModified(fields,sync,condition));
        return sFields;
    }
    getSelectQueryTable(){ return mysql.format(`? AS 'TABLE'`,[this.table]); }
    getSelectQueryCreated(fields,sync,condition){
        const sFld = 'CREATED', cFld = sFld + '_DATE', and = condition ? 'AND '+condition : '';
        if(!_.includes(fields,cFld)) return mysql.format(`? AS ?`,[0,sFld]);
        if(!sync) return mysql.format(`(SELECT COUNT(*) FROM ?? WHERE ?? IS NOT NULL ${and}) AS ?`,[this.table,cFld,sFld]);
        return mysql.format(`(SELECT COUNT(*) FROM ?? WHERE ?? > ? ${and}) AS ?`,[this.table,cFld,sync,sFld]);
    }
    getSelectQueryModified(fields,sync,condition){
        const sFld = 'MODIFIED', cFld = sFld + '_DATE', and = condition ? 'AND '+condition : '';
        if(!_.includes(fields,cFld) || !sync) return mysql.format(`? AS ?`,[0,sFld]);
        if(_.includes(fields,'CREATED_DATE'))
            return mysql.format(`(SELECT COUNT(*) FROM ?? WHERE ?? > ? AND ?? <= ? ${and}) AS ?`,[this.table,cFld,sync,"CREATED_DATE",sync,sFld]);
        return mysql.format(`(SELECT COUNT(*) FROM ?? WHERE ?? > ? ${and}) AS ?`,[this.table,cFld,sync,sFld]);
    }
}