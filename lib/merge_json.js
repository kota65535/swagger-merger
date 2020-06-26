/**
 * Created by WindomZ on 17-4-11.
 */
'use strict'

const path = require('path')
const fs = require('fs')

const fmtconv = require('fmtconv')

const { isHTTP, isTmpDir, download } = require('./remote')
const { parseRef, sliceHashtag } = require('./reference')

const regFixBlock = new RegExp(`{\\[(.+?)\\]}`, 'g')

/**
 * Merge JSON swagger strings.
 *
 * @param {string} tag
 * @param {string} dir
 * @param {object} obj
 * @return {string}
 * @api public
 */
function mergeJSON (tag, dir, obj) {
  const json = mergeNestedJSON(tag, dir, obj)
  return JSON.stringify(json).replace(regFixBlock, s => {
    return s.substring(1, s.length - 1)
  })
}

/**
 * Merge nested JSON swagger strings.
 *
 * @param {string} tag
 * @param {string} dir
 * @param {object} obj
 * @return {object}
 * @api private
 */
function mergeNestedJSON (tag, dir, obj) {
  if (!obj) {
    return obj
  }
  let ret
  switch (obj.constructor.name) {
    case 'Object':
      ret = {}
      break
    case 'Array':
      ret = []
      break
    default:
      return obj
  }

  for (const [key, ref] of Object.entries(obj)) {
    if (!key.startsWith('$ref')) {
      ret[key] = mergeNestedJSON(tag, dir, ref)
      continue
    }

    // parse ref
    let { protocol, filePath, hashtag } = parseRef(ref)

    // read the url contents
    if (isHTTP(protocol)) {
      ret[key] = download(tag, filePath) + (hashtag ? ('#' + hashtag) : '')
      continue
    }

    if (isTmpDir(ref)) {
      dir = ''
    }

    // skip if ref to the root file
    if (!filePath) {
      ret[key] = ref
      continue
    }

    filePath = path.join(dir, filePath)

    // read the file contents.
    try {
      fs.accessSync(filePath, fs.R_OK)
    } catch (e) {
      console.error('error: "' + ref + '" does not exist.')
      continue
    }
    let fileContext = '' + fs.readFileSync(filePath)
    if (!fileContext) {
      if (!isTmpDir(ref)) console.error('error: "' + ref + '" should not be empty.')
      continue
    }

    let childObj
    // core code - swagger merge $ref
    let ext = path.extname(filePath).toLowerCase()
    if (!ext) ext = '.yaml'
    switch (ext) {
      case '.json':
        // handle the hashtag
        childObj = sliceHashtag(JSON.parse(fileContext), hashtag)
        break
      case '.yaml':
      case '.yml':
        // yaml to json, handle the hashtag
        childObj = sliceHashtag(JSON.parse(fmtconv.stringYAML2JSON(fileContext)), hashtag)
        break
      default:
        continue
    }

    let dirName = path.dirname(filePath)
    childObj = mergeNestedJSON(tag, dirName, childObj)

    if (ret.constructor.name === 'Object' && Object.keys(ret).length === 0 && childObj.constructor.name === 'Array') {
      ret = []
    }
    if (childObj.constructor.name === 'Array') {
      ret = ret.concat(childObj)
    } else {
      ret = Object.assign({}, ret, childObj)
    }
  }
  return ret
}

module.exports = mergeJSON
