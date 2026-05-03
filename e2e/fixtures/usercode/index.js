const fs = require('fs')

const getTemperature = async (data) => {
  const url = data.url
  const {lat, lon} = data
  const base = `${url}?latitude=${lat}&longitude=${lon}&current_weather=true`

  const res = await (await fetch(base)).json()

  const {current_weather_units, current_weather} = res
  const unit = current_weather_units.temperature
  const time = current_weather.time
  const temperature = current_weather.temperature

  return {
    unit,
    time,
    temperature,
  }
}

const saveTemperature = async (data) => {
  if (!fs.existsSync(data.file)) {
    fs.writeFileSync(data.file, '')
  }

  const {message} = data
  fs.appendFileSync(data.file, `${message}\r\n`)
}

const disabledAction = async (data) => {}

// export actions/hooks
module.exports = {
  getTemperature,
  saveTemperature,
  disabledAction,
}
