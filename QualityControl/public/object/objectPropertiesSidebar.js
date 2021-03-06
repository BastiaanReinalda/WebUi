import {h} from '/js/src/index.js';

/**
 * Form too edit properties of an object, this fits well inside the sidebar
 * @param {Object} model
 * @return {vnode}
 */
export default function objectPropertiesSidebar(model) {
  const tabObject = model.layout.editingTabObject;

  return h('.p2', [
    h('div', 'Size'),
    h('.p3', [
      h('.flex-row', [
        btnSize(model, tabObject, 1, 1), ' ',
        btnSize(model, tabObject, 2, 1), ' ',
        btnSize(model, tabObject, 3, 1), ' ',
      ]),
      h('.flex-row', {class: ''}, [
        btnSize(model, tabObject, 1, 2), ' ',
        btnSize(model, tabObject, 2, 2), ' ',
        btnSize(model, tabObject, 3, 2), ' ',
      ]),
      h('.flex-row', [
        btnSize(model, tabObject, 1, 3), ' ',
        btnSize(model, tabObject, 2, 3), ' ',
        btnSize(model, tabObject, 3, 3), ' ',
      ]),
    ]),

    h('hr'),

    h('div', 'Options'),
    h('.p3', [
      h('.flex-row', [
        btnOption(model, tabObject, 'logx'), ' ',
        btnOption(model, tabObject, 'logy'), ' ',
      ]),
      h('.flex-row', [
        btnOption(model, tabObject, 'gridx'), ' ',
        btnOption(model, tabObject, 'gridy'), ' ',
      ]),
      h('', [
        btnOption(model, tabObject, 'lego'), ' ',
      ]),
      h('', [
        btnOption(model, tabObject, 'stat'), ' ',
      ]),
    ]),

    h('hr'),

    h('p.f6.text-center', 'Object name: ' + tabObject.name),
    h('.text-center', [
      h('button.btn', {onclick: () => model.layout.editTabObject(null)}, 'Back to object tree'),
      ' ',
      h('button.btn.btn-danger', {onclick: () => model.layout.deleteTabObject(tabObject)}, 'Delete this object'),
    ]),

    h('hr'),
  ]);
}

/**
 * Shows a button to change size width and height e.g.: "1x3"
 * @param {Object} model
 * @param {Object} tabObject - the tabOject to be changed
 * @param {number} width - size the button will handle
 * @param {number} height - size the button will handle
 * @return {vnode}
 */
const btnSize = (model, tabObject, width, height) => h('.form-check.w-33', [
  h('input.form-check-input', {
    type: 'radio',
    id: tabObject.id + width + height,
    checked: tabObject.w === width && tabObject.h === height,
    onchange: () => model.layout.resizeTabObject(tabObject, width, height)
  }),
  h('label', {for: tabObject.id + width + height}, `${width}x${height}`)
]);

/**
 * Shows a button to toggle a jsroot option like grid or scale
 * @param {Object} model
 * @param {Object} tabObject - the tabOject to be changed
 * @param {string} option - jsroot option
 * @return {vnode}
 */
const btnOption = (model, tabObject, option) => h('.form-check.w-33', [
  h('input.form-check-input', {
    type: 'checkbox',
    id: tabObject.id + option,
    checked: (tabObject.options || []).indexOf(option) >= 0,
    onchange: () => model.layout.toggleTabObjectOption(tabObject, option)
  }),
  h('label', {for: tabObject.id + option}, option)
]);


