// Create an object to be used in a template from SQL rows
function tilsObject(tils) {
    tils_combined = Object();
  
    tils.forEach(element => {
      tils_combined[element.title] = Object();
      tils_combined[element.title]["til_id"] = element.id;
      tils_combined[element.title]["title"] = element.title;
      tils_combined[element.title]["date"] = new Date(element.date);
      tils_combined[element.title]["repetitions"] = element.repetitions;
      tils_combined[element.title]["last_repetition"] = new Date(element.last_repetition);
      tils_combined[element.title]["description"] = element.description;
      tils_combined[element.title]["tags"] = element.tags.split(',');
    });
  
    tils_keys = [];
    for (key in tils_combined) {
      tils_keys.push(tils_combined[key]["title"]);
    }
  
    return [tils_combined, tils_keys];
  }

module.exports = tilsObject;