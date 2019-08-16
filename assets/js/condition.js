function getConditionData(data) {
    if (_.isArray(data)) return conditionStringFromArray(data);
    if (_.isObject(data)) return conditionStringFromObject(data);
    if (_.trim(data) === '') return null; data = _.trim(data);
    if (_.includes(['{', '['], data.substr(0, 1))) return getConditionData(JSON.parse(data));
    return conditionStringFromText(data);
}
function conditionStringFromText(text, precedent = null) {
    if (_.isString(primary_key)) return getConditionString(primary_key, text, '=', precedent);
    if (Array.isArray(primary_key) && primary_key.length === 1) return getConditionString(primary_key[0], text, '=', precedent);
    return null;
}
function conditionStringFromObject(Obj) {
    let precedent = null, operand = '=', field, value;
    _.forEach(Obj, function (val, name) {
        switch (name) {
            case 'operand': operand = val; break;
            case 'precedent': precedent = val; break;
            default: { field = name; value = val; break; }
        }
    });
    return getConditionString(field, value, operand, precedent);
}
function conditionStringFromArray(ary) {
    if (!_.some(ary, _.isObject)) return conditionStringFromText(ary);
    return condition = arrayToConditionsArray(ary).join(' ');
}
function arrayToConditionsArray(ary) {
    return _.map(ary, function (item, i) {
        if (_.isString(item) || _.isNumber(item) || _.isArray(item)) return conditionStringFromText(item, (i ? 'AND' : null));
        if (i && _.isObject(item) && !_.has(item, 'precedent')) item.precedent = 'AND';
        return conditionStringFromObject(item);
    })
}
function getConditionString(field, value, operand = '=', precedent = null) {
    precedent = precedent || '';
    let conditionString = Array.isArray(value)
        ? mysql.format(`${precedent} ?? IN (?)`, [field, value])
        : mysql.format(`${precedent} ?? ${operand} ?`, [field, value]);
    return _.trim(conditionString);
}
