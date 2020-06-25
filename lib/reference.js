/**
 * Created by WindomZ on 18-2-26.
 */
'use strict'

/**
 * Split the reference definition to file path and hashtag path.
 * start with '$ref' or '$ref#'.
 *
 * @param {string} ref
 * @return {object}
 * @api private
 */
const url = require('url')

function splitReference (ref) {
  // parse out the file path.
  // file path cases: ./responses.yaml
  // parse out the hashtag path from the file path.
  // hashtag path cases: #/components/root/get
  let filePath, hashtag
  let idxHashtag = ref.indexOf('#')
  if (idxHashtag > 5) {
    filePath = ref.slice(0, idxHashtag)
    if (filePath.endsWith('/') || filePath.endsWith('\\')) {
      filePath = ref
      return { filePath }
    }

    hashtag = ref.slice(idxHashtag + 1)

    // in case of windows operating system
    hashtag = hashtag.replace(/\\/g, '/')

    if (hashtag.startsWith('/')) {
      hashtag = hashtag.slice(1)
    }
  }
  if (!filePath) filePath = ref
  return { filePath, hashtag }
}

function parseRef (ref) {
  const u = url.parse(ref)
  const filePath = u.path
  let hashtag = null
  if (u.hash) {
    const mo = u.hash.match(/#\/?(.+)/)
    if (mo) {
      hashtag = mo[1]
    }
  }
  return { filePath, hashtag }
}

/**
 * Slice hashtag path from JSON content.
 *
 * @param {string} content
 * @param {string} hashtag
 * @return {string}
 * @api private
 */
function sliceHashtagJSON (obj, hashtag) {
  if (hashtag) {
    hashtag.split('/').every(k => {
      obj = Object.getOwnPropertyDescriptor(obj, k).value
      return obj
    })
  }
  return obj
}

module.exports.splitReference = splitReference
module.exports.sliceHashtag = sliceHashtagJSON
module.exports.parseRef = parseRef
