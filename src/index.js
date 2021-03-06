export function h(name, props) {
  var node
  var stack = []
  var children = []

  for (var i = arguments.length; i-- > 2; ) {
    stack.push(arguments[i])
  }

  while (stack.length) {
    if (Array.isArray((node = stack.pop()))) {
      for (i = node.length; i--; ) {
        stack.push(node[i])
      }
    } else if (null == node || true === node || false === node) {
    } else {
      children.push(typeof node === "number" ? node + "" : node)
    }
  }

  return typeof name === "string"
    ? {
        name: name,
        props: props || {},
        children: children
      }
    : name(props || {}, children)
}

export function app(state, actions, view, container) {
  var patchLock
  var lifecycle = []
  var root = container && container.children[0]
  var node = vnode(root, [].map)

  repaint(init([], (state = copy(state)), (actions = copy(actions))))

  return actions

  function vnode(element, map) {
    return (
      element && {
        name: element.nodeName.toLowerCase(),
        props: {},
        children: map.call(element.childNodes, function(element) {
          return 3 === element.nodeType
            ? element.nodeValue
            : vnode(element, map)
        })
      }
    )
  }

  function render(next) {
    patchLock = !patchLock
    next = view(state, actions)

    if (container && !patchLock) {
      root = patch(container, root, node, (node = next))
    }

    while ((next = lifecycle.pop())) next()
  }

  function repaint() {
    if (!patchLock) {
      patchLock = !patchLock
      setTimeout(render)
    }
  }

  function copy(a, b) {
    var target = {}

    for (var i in a) target[i] = a[i]
    for (var i in b) target[i] = b[i]

    return target
  }

  function set(path, value, source, target) {
    if (path.length) {
      target[path[0]] =
        1 < path.length ? set(path.slice(1), value, source[path[0]], {}) : value
      return copy(source, target)
    }
    return value
  }

  function get(path, source) {
    for (var i = 0; i < path.length; i++) {
      source = source[path[i]]
    }
    return source
  }

  function init(path, slice, actions) {
    for (var key in actions) {
      typeof actions[key] === "function"
        ? (function(key, action) {
            actions[key] = function(data) {
              slice = get(path, state)

              if (typeof (data = action(data)) === "function") {
                data = data(slice, actions)
              }

              if (data && data !== slice && !data.then) {
                repaint((state = set(path, copy(slice, data), state, {})))
              }

              return data
            }
          })(key, actions[key])
        : init(
            path.concat(key),
            (slice[key] = slice[key] || {}),
            (actions[key] = copy(actions[key]))
          )
    }
  }

  function getKey(node) {
    return node && node.props ? node.props.key : null
  }

  function setElementProp(element, name, value, oldValue) {
    if (name === "key") {
    } else if (name === "style") {
      for (var i in copy(oldValue, value)) {
        element[name][i] = null == value || null == value[i] ? "" : value[i]
      }
    } else {
      try {
        element[name] = null == value ? "" : value
      } catch (_) {}

      if (typeof value !== "function") {
        if (null == value || false === value) {
          element.removeAttribute(name)
        } else {
          element.setAttribute(name, value)
        }
      }
    }
  }

  function createElement(node, isSVG) {
    if (typeof node === "string") {
      var element = document.createTextNode(node)
    } else {
      var element = (isSVG = isSVG || "svg" === node.name)
        ? document.createElementNS("http://www.w3.org/2000/svg", node.name)
        : document.createElement(node.name)

      if (node.props.oncreate) {
        lifecycle.push(function() {
          node.props.oncreate(element)
        })
      }

      for (var i = 0; i < node.children.length; i++) {
        element.appendChild(createElement(node.children[i], isSVG))
      }

      for (var name in node.props) {
        setElementProp(element, name, node.props[name])
      }
    }
    return element
  }

  function updateElement(element, oldProps, props) {
    for (var name in copy(oldProps, props)) {
      if (
        props[name] !==
        ("value" === name || "checked" === name
          ? element[name]
          : oldProps[name])
      ) {
        setElementProp(element, name, props[name], oldProps[name])
      }
    }

    if (props.onupdate) {
      lifecycle.push(function() {
        props.onupdate(element, oldProps)
      })
    }
  }

  function removeChildren(element, node, props) {
    if ((props = node.props)) {
      for (var i = 0; i < node.children.length; i++) {
        removeChildren(element.childNodes[i], node.children[i])
      }

      if (props.ondestroy) {
        props.ondestroy(element)
      }
    }
    return element
  }

  function removeElement(parent, element, node, cb) {
    function done() {
      parent.removeChild(removeChildren(element, node))
    }

    if (node.props && (cb = node.props.onremove)) {
      cb(element, done)
    } else {
      done()
    }
  }

  function patch(parent, element, oldNode, node, isSVG, nextSibling) {
    if (node === oldNode) {
    } else if (null == oldNode) {
      element = parent.insertBefore(createElement(node, isSVG), element)
    } else if (node.name && node.name === oldNode.name) {
      updateElement(element, oldNode.props, node.props)

      var oldElements = []
      var oldKeyed = {}
      var newKeyed = {}

      for (var i = 0; i < oldNode.children.length; i++) {
        oldElements[i] = element.childNodes[i]

        var oldChild = oldNode.children[i]
        var oldKey = getKey(oldChild)

        if (null != oldKey) {
          oldKeyed[oldKey] = [oldElements[i], oldChild]
        }
      }

      var i = 0
      var j = 0

      while (j < node.children.length) {
        var oldChild = oldNode.children[i]
        var newChild = node.children[j]

        var oldKey = getKey(oldChild)
        var newKey = getKey(newChild)

        if (newKeyed[oldKey]) {
          i++
          continue
        }

        if (null == newKey) {
          if (null == oldKey) {
            patch(element, oldElements[i], oldChild, newChild, isSVG)
            j++
          }
          i++
        } else {
          var recyledNode = oldKeyed[newKey] || []

          if (oldKey === newKey) {
            patch(element, recyledNode[0], recyledNode[1], newChild, isSVG)
            i++
          } else if (recyledNode[0]) {
            patch(
              element,
              element.insertBefore(recyledNode[0], oldElements[i]),
              recyledNode[1],
              newChild,
              isSVG
            )
          } else {
            patch(element, oldElements[i], null, newChild, isSVG)
          }

          j++
          newKeyed[newKey] = newChild
        }
      }

      while (i < oldNode.children.length) {
        var oldChild = oldNode.children[i]
        if (null == getKey(oldChild)) {
          removeElement(element, oldElements[i], oldChild)
        }
        i++
      }

      for (var i in oldKeyed) {
        if (!newKeyed[oldKeyed[i][1].props.key]) {
          removeElement(element, oldKeyed[i][0], oldKeyed[i][1])
        }
      }
    } else if (node.name === oldNode.name) {
      element.nodeValue = node
    } else {
      element = parent.insertBefore(
        createElement(node, isSVG),
        (nextSibling = element)
      )
      removeElement(parent, nextSibling, oldNode)
    }
    return element
  }
}
