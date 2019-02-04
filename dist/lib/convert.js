const Promise = require("bluebird");
const rp = require("request-promise");
const xlsx = require("node-xlsx");
const R = require("ramda");

const API_URL = "https://kehitysjulkinen.vayla.fi/vkm-api";
const VKM_URL = API_URL + "/muunnin";
const GEOCODE_URL = API_URL + "/geocode";
const REVERSE_GEOCODE_URL = API_URL + "/reversegeocode";
const INTERVAL_ROAD_ADDRESS_URL = API_URL + "/tieosoitevali";
const ROAD_ADDRESS_URL = API_URL + "/tieosoitehaku";
const XY_COORDINATE_URL = API_URL + "/xyhaku";

const POINT_HEADERS = ["X", "Y", "Tie", "Ajoradat", "Tieosa", "Etäisyys", "Katunimi", "Katunumero", "Kunta", "Ely", "Urakka-alue"];
const POINT_DAYS_HEADERS = ["Tie", "Ajorata", "Tieosa", "Etäisyys", "Tilannepvm", "Kohdepvm", "Tie output", "Ajorata output", "Tieosa output", "Etäisyys output"];
const INTERVAL_HEADERS = ["Tie", "Ajorata", "Tieosa (alkupiste)", "Etäisyys (alkupiste)", "Tieosa (loppupiste)", "Etäisyys (loppupiste)", "AlkuX", "AlkuY", "LoppuX", "LoppuY"];
const ERROR_HEADER = "Virheviesti";

const COORDINATE_KEYS = ["x", "y"];

const ROAD_ADDRESS_KEYS = ["tie", "ajoradat", "osa", "etaisyys"];
const ROAD_ADDRESS_KEYS_OUTPUT = ["tie", "ajorata", "osa", "etaisyys"];
const ROAD_ADDRESS_KEYS_OUT = ["tie_out", "ajorata_out", "osa_out", "etaisyys_out"];

const STREET_ADDRESS_KEYS = ["katunimi", "katunumero", "kuntakoodi"];
const STREET_ADDRESS_KEYS_OUTPUT = ["tienimiFi", "katunumero", "kuntakoodi"];

const INTERVAL_ROAD_ADDRESS_KEYS = ["tie", "ajoradat", "osa", "etaisyys", "losa", "let"];
const INTERVAL_ROAD_ADDRESS_KEYS_OUTPUT = ["tie", "ajorata", "osa", "etaisyys", "losa", "let"];

const OTHER_ADDRESS_KEYS = ["ely", "gridcode"];
const OTHER_DAYS_KEYS = ["tilannepvm","kohdepvm"];
const INTERVAL_COORDINATE_KEYS = ["alkux", "alkuy", "loppux", "loppuy"];
const EXTERNAL_ERROR_KEYS = ["palautusarvo", "virheteksti"];
const ERROR_KEYS = ["valid", "error"].concat(EXTERNAL_ERROR_KEYS);

const POINT_KEYS = COORDINATE_KEYS.concat(ROAD_ADDRESS_KEYS).concat(STREET_ADDRESS_KEYS).concat(OTHER_ADDRESS_KEYS);
const POINT_KEYS_OUTPUT = COORDINATE_KEYS.concat(ROAD_ADDRESS_KEYS).concat(STREET_ADDRESS_KEYS_OUTPUT).concat(OTHER_ADDRESS_KEYS);

const INTERVAL_KEYS = INTERVAL_ROAD_ADDRESS_KEYS.concat(INTERVAL_COORDINATE_KEYS);
const INTERVAL_KEYS_OUTPUT = INTERVAL_ROAD_ADDRESS_KEYS.concat(INTERVAL_COORDINATE_KEYS);

const POINT_DAYS_KEYS = ROAD_ADDRESS_KEYS.concat(OTHER_DAYS_KEYS);
const POINT_DAYS_KEYS_OUTPUT = ROAD_ADDRESS_KEYS.concat(OTHER_DAYS_KEYS).concat(ROAD_ADDRESS_KEYS_OUT);
const OPTIONAL_INTERVAL_KEYS = ["ajoradat"];

const MISSING_VALUE_ERROR = "Kohdetta ei löytynyt";

const CONCURRENT_REQUEST_LIMIT = 5;

exports.convert = function(buffer) {
	console.log("In converter, main");
  return parseInput(buffer)
    .then(validateValues)
    .then(convertValues)
    .then(buildOutput);
}


function parseInput(buffer) {
	console.log("In converter, parse");
  const parse = Promise.method(buffer => {
    const worksheet = xlsx.parse(buffer)[0];
    const table = worksheet.data;
    return { name: worksheet.name, header: headersToKeys(table[0]), values: parseTable(table) };
  });
  
  return parse(buffer).catch(_ => Promise.reject(Promise.OperationalError("Parsing input failed")));
}


function validateValues(data) {
  const values = data.values;
  const type = determineType(data.header);
  const valid = x => !R.any(R.isNil, R.flatten(R.map(R.values, x)));
  const requiredValues = type === "intervalRoadAddress" ? R.map(R.omit(OPTIONAL_INTERVAL_KEYS), values) : values;

  if (valid(requiredValues)) {
    return R.merge(data, { type: type });
  } else {
      const validation = x => R.any(R.or(R.isNil, R.isEmpty), R.values(x));
      return Promise.reject(Promise.OperationalError(validationError(validation, requiredValues)));
  }
}


function determineType(headerKeys) {
  const headersEqual = R.equals(headerKeys);
  
  if (headersEqual(COORDINATE_KEYS)) return "coordinate";
  if (headersEqual(ROAD_ADDRESS_KEYS)) return "roadAddress";
  if (headersEqual(INTERVAL_ROAD_ADDRESS_KEYS)) return "intervalRoadAddress";
  if (headersEqual(ROAD_ADDRESS_KEYS.concat(OTHER_DAYS_KEYS))) return "daysRoadAddress";
  throw Promise.OperationalError("You must specity a header");
}


function convertValues(data) {
  const resultByType = {
    coordinate: values => addRoadAddresses(values).then(addStreetAddresses),
    roadAddress: values => addCoordinates(values).then(addStreetAddresses),
    streetAddress: values => addGeocodedCoordinates(values).then(addRoadAddresses),
    intervalRoadAddress: values => addIntervalCoordinates(values),
    daysRoadAddress: values => addRoadAddressesWDays(values)
  };

  return resultByType[data.type](data.values).then(x => {
    return R.assoc("values", x, data);
  });
}


function buildOutput(data) {
  const interval = data.type === "intervalRoadAddress";
  const bydays = data.type === "daysRoadAddress";
  var keys;
  var headers;

  if(interval){
    keys = INTERVAL_KEYS_OUTPUT;
    headers = INTERVAL_HEADERS;
  }else if(bydays){
    keys = POINT_DAYS_KEYS_OUTPUT;
    headers = POINT_DAYS_HEADERS;
  }else{
    keys = POINT_KEYS_OUTPUT;
    headers = POINT_HEADERS;
  }

  const values = data.values;
	console.log(data.values);
  const valuesOrderedByKeys = values.map(x => {
    const valueOrderedByKeys = keys.map(key => R.prop(key, x));
    return x.valid ? valueOrderedByKeys : valueOrderedByKeys.concat(x.error);
  });
	console.log(valuesOrderedByKeys);

  const metadata = getMetadata(values);
  const headerRow = metadata.errors ? headers.concat(ERROR_HEADER) : headers;
  const table = [headerRow].concat(valuesOrderedByKeys);

  return {
    xlsx: xlsx.build([{name: data.fileName, data: table }]),
    metadata: metadata
  };
}


function getMetadata(data) {
  const notValid = R.compose(R.not, R.prop("valid"));
  
  if (R.any(notValid, data)) {
    return validationError(notValid, data);
  } else {
    return { errors: false };
  }
}


function validationError(validationFn, data) {
  const rowOffset = 2;
  
  return {
    errors: true,
    errorCount: R.filter(validationFn, data).length,
    firstError: R.findIndex(validationFn, data) + rowOffset
  };
}


function parseTable(values) {
  const header = values[0] || [];
  const headerConsistsOf = a => R.all(x => R.contains(x, a), header);
  const headerIsValid = headerConsistsOf(POINT_HEADERS) || headerConsistsOf(POINT_DAYS_HEADERS) || headerConsistsOf(INTERVAL_HEADERS);

  if (headerIsValid) {
    const onlyNonEmptyRows = R.reject(R.all(R.isEmpty));
    return tableToObjects(onlyNonEmptyRows(values));
  } else {
    throw Promise.OperationalError("You must specity a header");
  }
}


function tableToObjects(table) {
  const headers = R.head(table);
  const content = R.tail(table);

  return R.map(R.zipObj(headersToKeys(headers)), content);
}


function headersToKeys(headerRow) {
  const headers = R.reject(R.isEmpty, headerRow);
  const allKeys = POINT_KEYS.concat(INTERVAL_KEYS).concat(POINT_DAYS_KEYS);
  const allHeaders = POINT_HEADERS.concat(INTERVAL_HEADERS).concat(POINT_DAYS_HEADERS);
  
  return R.map(x => allKeys[allHeaders.indexOf(x)], headers);
}


function addRoadAddresses(values) {
	  const pointData = value => httpGet(XY_COORDINATE_URL, R.pick(COORDINATE_KEYS, value));
	  
	  return Promise.map(values, pointData, { concurrency: CONCURRENT_REQUEST_LIMIT })
	    .map(R.pick(ROAD_ADDRESS_KEYS_OUTPUT.concat(OTHER_ADDRESS_KEYS)))
	    .then(mergeAllWith(values));
}


function addCoordinates(values) {
	const roadAddressData = (value) =>
    		httpGet(ROAD_ADDRESS_URL, R.pick(ROAD_ADDRESS_KEYS, value))
      		.then(response => R.merge(value, getXYFromResponse(response)));
    		
  	return Promise.map(values, roadAddressData, { concurrency: CONCURRENT_REQUEST_LIMIT });
}


function addRoadAddressesWDays(values) {
	var kohdepvm;
	var tilannepvm;
	  for (var i in values) {
		  if (typeof values[i].tilannepvm === "string") {
			  if (values[i].tilannepvm.includes('.')) {
				  tilannepvm = values[i].tilannepvm;
			  }
		  } else {
			  tilannepvm = new Date(1900, 0, values[i].tilannepvm - 1);
			  values[i].tilannepvm = ((tilannepvm.getDate() < 10 ? '0' : '') + tilannepvm.getDate())+"."+(((tilannepvm.getMonth()+1) < 10 ? '0' : '') + (tilannepvm.getMonth()+1))+"."+tilannepvm.getFullYear();
		  }
		  if (typeof values[i].kohdepvm === "string") {
			  if (values[i].kohdepvm.includes('.')) {
				  kohdepvm = values[i].kohdepvm;
			  }
		  } else {
			  kohdepvm = new Date(1900, 0, values[i].kohdepvm - 1);
			  values[i].kohdepvm = ((kohdepvm.getDate() < 10 ? '0' : '') + kohdepvm.getDate())+"."+(((kohdepvm.getMonth()+1) < 10 ? '0' : '') + (kohdepvm.getMonth()+1))+"."+kohdepvm.getFullYear();
		  }
	  }
	  const historyConversion = value => httpGet(ROAD_ADDRESS_URL, R.pick(POINT_DAYS_KEYS, value)).then(function (response) {
		      response = response[0];
		      var renamed = renameKeys({ ajorata: 'ajorata_out', etaisyys: 'etaisyys_out', osa: 'osa_out', tie: 'tie_out' })(response);
		      var valuesObject = values[0];
		      var merged = R.merge(renamed, valuesObject);
		      return merged;
	  		});
	  
	  return Promise.map(values, historyConversion, { concurrency: CONCURRENT_REQUEST_LIMIT })
	    .map(R.pick(POINT_DAYS_KEYS_OUTPUT.concat(OTHER_ADDRESS_KEYS)))
	    .then(mergeAllWith(values));
}


function addStreetAddresses(values) {
  const reverseGeocode = value => httpGet(REVERSE_GEOCODE_URL, R.pick(COORDINATE_KEYS, value));
  
  return Promise.map(values, reverseGeocode, { concurrency: CONCURRENT_REQUEST_LIMIT })
    .map(R.pick(STREET_ADDRESS_KEYS_OUTPUT.concat(OTHER_ADDRESS_KEYS)))
    .then(mergeAllWith(values));
}


function addGeocodedCoordinates(values) {
  const propertiesToString = R.compose(R.join(", "), R.values, R.pick(STREET_ADDRESS_KEYS));
  const geocode = value => httpGet(GEOCODE_URL, { address: propertiesToString(value) });
  
  return Promise.map(values, geocode, { concurrency: CONCURRENT_REQUEST_LIMIT })
    .map(R.pipe(
      R.prop("results"),
      headOr({valid: false, error: MISSING_VALUE_ERROR})))
    .then(mergeAllWith(values));
}


function addIntervalCoordinates(values) {
	const intervalStreetAddress = (value) =>
    httpGet(INTERVAL_ROAD_ADDRESS_URL, R.pick(INTERVAL_ROAD_ADDRESS_KEYS, value))
      .then(response => R.merge(value, getEndpointsFromResponse(response)));
    
  return Promise.map(values, intervalStreetAddress, { concurrency: CONCURRENT_REQUEST_LIMIT });
}


function getEndpointsFromResponse(response) {
  response = response[0];
  const start = R.path(["alkupiste"], response);
  const end = R.path(["loppupiste"], response);
  
  if (start && end) {
    const startPointX = R.prop("x", start);
    const startPointY = R.prop("y", start);
    const endPointX = R.prop("x", end);
    const endPointY = R.prop("y", end);    
    
    if (startPointX && startPointY && endPointX && endPointY) {
    	return { alkux: startPointX, alkuy: startPointY, loppux: endPointX, loppuy: endPointY, valid: true };
    }
  }
  return { error: response.virhe || MISSING_VALUE_ERROR, valid: false };
}


function getXYFromResponse(response) {
	  response = response[0];
	    const PointX = R.prop("x", response);
	    const PointY = R.prop("y", response);  
	    
	    if (PointX && PointY) {
	    	return { x: PointX, y: PointY, valid: true };
	    }
	  return { error: response.virhe || MISSING_VALUE_ERROR, valid: false };
}


function httpGet(url, params) {
  return rp({ url: url, qs: params }).then(parseJSON);
}


function parseJSON(str) {
  return str.trim() ? JSON.parse(str) : {};
}


function mergeAllWith(xs) {
  const defaults = R.flip(R.merge);
  
  return R.zipWith(defaults, xs);
}


function validate(x) {
  if (R.has("valid", x)) return x;
  const validationStatus = x.palautusarvo === 1 ?
    { valid: true } :
    { valid: false, error: x.virheteksti || MISSING_VALUE_ERROR };
    
  return R.merge(R.omit(EXTERNAL_ERROR_KEYS, x), validationStatus);
}


function headOr(defaultVal) {
  return function(xs) {
    return xs.length > 0 ? xs[0] : defaultVal;
  };
}


/**
 * Creates a new object with the own properties of the provided object, but the
 * keys renamed according to the keysMap object as `{oldKey: newKey}`.
 * When some key is not found in the keysMap, then it's passed as-is.
 *
 * Keep in mind that in the case of keys conflict is behaviour undefined and
 * the result may vary between various JS engines!
 *
 * @sig {a: b} -> {a: *} -> {b: *}
 */
const renameKeys = R.curry((keysMap, obj) => {
  return R.reduce((acc, key) => {
    acc[keysMap[key] || key] = obj[key];
    return acc;
  }, {}, R.keys(obj));
});
