class SQLCondition {
    constructor(tblData) {
        ['primary_key','condition']
            .forEach(key => this[key] = tblData[key]);
    }
    get(){
        return this.getConditionData(this.condition)
    }
    getConditionData(data) {
        if (_.isArray(data)) return this.conditionStringFromArray(data);
        if (_.isObject(data)) return this.conditionStringFromObject(data);
        if (_.trim(data) === '') return null; data = _.trim(data);
        if (_.includes(['{', '['], data.substr(0, 1))) return this.getConditionData(JSON.parse(data));
        return this.conditionStringFromText(data);
    }
    conditionStringFromText(text, precedent = null) {
        if (_.isString(this.primary_key)) return this.getConditionString(this.primary_key, text, '=', precedent);
        if (Array.isArray(this.primary_key) && this.primary_key.length === 1) return this.getConditionString(this.primary_key[0], text, '=', precedent);
        return null;
    }
    conditionStringFromObject(Obj) {
        let precedent = Obj.precedent || 'AND', operand = Obj.operand || '=', conditions = [], i = 0, cls = this;
        _.forEach(Obj, function (value, name) {
            if(!_.includes(['precedent','operand'],name)){
                conditions.push(cls.getConditionString(name, value, operand, (i++) ? precedent : null))
            }
        });
        return conditions.join(' ');
    }
    conditionStringFromArray(ary) {
        if (!_.some(ary, _.isObject)) return this.conditionStringFromText(ary);
        return '(' + this.arrayToConditionsArray(ary).join(') AND (') + ')';
    }
    arrayToConditionsArray(ary) {
        let cls = this;
        return _.map(ary, function (item, i) {
            if (_.isString(item) || _.isNumber(item) || _.isArray(item)) return cls.conditionStringFromText(item, (i ? 'AND' : null));
            if (i && _.isObject(item) && !_.has(item, 'precedent')) item.precedent = 'AND';
            return cls.conditionStringFromObject(item);
        })
    }
    getConditionString(field, value, operand = '=', precedent = null) {
        precedent = precedent || '';
        let conditionString = Array.isArray(value)
            ? mysql.format(`${precedent} ?? IN (?)`, [field, value])
            : mysql.format(`${precedent} ?? ${operand} ?`, [field, value]);
        return _.trim(conditionString);
    }
}