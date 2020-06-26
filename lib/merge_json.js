/**
 * Created by WindomZ on 17-4-11.
 */
'use strict'

const path = require('path')
const fs = require('fs')

const fmtconv = require('fmtconv')
const deepmerge = require('deepmerge')

const { isHTTP, isTmpDir, download } = require('./remote')
const { parseRef, sliceHashtag } = require('./reference')

const regFixBlock = new RegExp(`{\\[(.+?)\\]}`, 'g')

/**
 * Merge JSON swagger strings.
 *
 * @param {string} tag
 * @param {string} dir
 * @param {object} obj
 * @param {boolean} isDeepMerge
 * @return {string}
 * @api public
 */
function mergeJSON (tag, dir, obj, isDeepMerge) {
  const json = mergeNestedJSON(tag, dir, obj, isDeepMerge)
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
 * @param {boolean} isDeepMerge
 * @return {object}
 * @api private
 */
function mergeNestedJSON (tag, dir, obj, isDeepMerge) {
  // same return type as the input object
  let ret
  if (isObject(obj)) {
    ret = {}
  } else if (isArray(obj)) {
    ret = []
  } else {
    // base case
    return obj
  }

  for (const [key, ref] of Object.entries(obj)) {
    // merge child object
    if (!key.startsWith('$ref')) {
      ret[key] = mergeNestedJSON(tag, dir, ref, isDeepMerge)
      continue
    }

    // parse ref
    let { protocol, filePath, hashtag } = parseRef(ref)

    // URL ref
    if (isHTTP(protocol)) {
      // temporary file path for saving remote file
      ret[key] = download(tag, filePath) + (hashtag ? ('#' + hashtag) : '')
      continue
    }
    // local ref
    if (!filePath) {
      ret[key] = ref
      continue
    }
    // remote ref, handling relative path
    if (!path.isAbsolute(filePath)) {
      filePath = path.join(dir, filePath)
    }

    // read the file contents.
    try {
      fs.accessSync(filePath, fs.R_OK)
    } catch (e) {
      console.error('error: "' + ref + '" does not exist.')
      continue
    }
    let fileContent = '' + fs.readFileSync(filePath)
    if (!fileContent) {
      if (!isTmpDir(ref)) console.error('error: "' + ref + '" should not be empty.')
      continue
    }

    let parsedContent
    let ext = path.extname(filePath).toLowerCase()
    if (!ext) ext = '.yaml'
    switch (ext) {
      case '.json':
        // handle the hashtag
        parsedContent = JSON.parse(fileContent)
        break
      case '.yaml':
      case '.yml':
        // yaml to json, handle the hashtag
        parsedContent = JSON.parse(fmtconv.stringYAML2JSON(fileContent))
        break
      default:
        // nothing to do
        continue
    }

    let refObj = sliceHashtag(parsedContent, hashtag)
    let dirName = path.dirname(filePath)
    refObj = mergeNestedJSON(tag, dirName, refObj, isDeepMerge)

    if (isEmptyObject(ret) && isArray(refObj)) {
      ret = []
    }
    ret = mergeObjects(ret, refObj, isDeepMerge)
  }
  return ret
}

function mergeObjects (obj1, obj2, isDeepMerge) {
  if (isDeepMerge) {
    return deepmerge(obj1, obj2)
  } else {
    if (isArray(obj1)) {
      return obj1.concat(obj2)
    } else {
      return Object.assign({}, obj1, obj2)
    }
  }
}

function isEmptyObject (obj) {
  return isObject(obj) && Object.keys(obj).length === 0
}

function isObject (obj) {
  return obj && obj.constructor.name === 'Object'
}

function isArray (obj) {
  return obj && obj.constructor.name === 'Array'
}

module.exports = mergeJSON
