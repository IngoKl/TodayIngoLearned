// Create an object to be used in a template from SQL rows
function tilsObject(tils, user_id) {
    const tils_combined = Object();

    tils.forEach(element => {
      const key = String(element.id);
      tils_combined[key] = Object();
      tils_combined[key]["user_id"] = user_id;
      tils_combined[key]["til_id"] = element.id;
      tils_combined[key]["title"] = element.title;
      tils_combined[key]["date"] = new Date(element.date);
      tils_combined[key]["repetitions"] = element.repetitions;
      tils_combined[key]["last_repetition"] = new Date(element.last_repetition);
      tils_combined[key]["description"] = element.description;
      tils_combined[key]["tags"] = element.tags ? element.tags.split(',') : [];
    });

    const tils_keys = [];
    for (const key in tils_combined) {
      tils_keys.push(key);
    }

    return [tils_combined, tils_keys];
  }

module.exports = tilsObject;
