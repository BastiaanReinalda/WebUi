import {h, iconBarChart, iconCaretRight, iconCaretBottom} from '/js/src/index.js';
import {draw} from './objectDraw.js';

/**
 * Shows a page to explore though a tree of objects with a preview on the right if clicked
 * and a status bar for selected object name and # of objects
 * @param {Object} model
 * @return {vnode}
 */
export default (model) => h('.flex-column.absolute-fill', {key: model.router.params.page}, [
  h('.flex-row.flex-grow', {oncreate: () => model.object.loadList()}, [
    h('.flex-grow.scroll-y', tableShow(model)),
    h('.animate-width.scroll-y', {
      style: {
        width: model.object.selected ? '50%' : 0
      }
    }, model.object.selected ? draw(model, model.object.selected.name) : null)
  ]),
  h('.f6.status-bar.ph1.flex-row', [
    statusBarLeft(model),
    statusBarRight(model),
  ])
]);

/**
 * Shows status of current tree with its options (online, loaded, how many)
 * @param {Object} model
 * @return {vnode}
 */
function statusBarLeft(model) {
  let itemsInfo;

  if (!model.object.list) {
    itemsInfo = 'Loading objects...';
  } else if (model.object.onlineMode) {
    if (!model.object.informationService) {
      itemsInfo = 'Waiting information service state...';
    } else if (model.object.searchInput) {
      itemsInfo = `${model.object.searchResult.length} found of ${model.object.listOnline.length} items (online mode)`;
    } else {
      itemsInfo = `${model.object.listOnline.length} items (online mode)`;
    }
  } else if (model.object.searchInput) {
    itemsInfo = `${model.object.searchResult.length} found of ${model.object.list.length} items`;
  } else {
    itemsInfo = `${model.object.list.length} items`;
  }

  return h('span.flex-grow', itemsInfo);
}

/**
 * Shows current selected object path
 * @param {Object} model
 * @return {vnode}
 */
const statusBarRight = (model) => model.object.selected
  ? h('span.right', model.object.selected.name)
  : null;

/**
 * Shows a tree of objects inside a table with indentation
 * @param {Object} model
 * @return {vnode}
 */
const tableShow = (model) => [
  h('table.table.table-sm.text-no-select', [
    h('thead', [
      h('tr', [
        h('th', {}, 'Name'),
        h('th', {style: {width: '6em'}}, 'Quality'),
      ])
    ]),
    h('tbody', [
      // The main table of the view can be a tree OR the result of a search
      model.object.searchInput ? searchRows(model) : treeRows(model),
    ])
  ])
];

/**
 * Shows a list of lines <tr> of objects
 * @param {Object} model
 * @return {vnode}
 */
const treeRows = (model) => !model.object.tree
  ? null
  : model.object.tree.childrens.map((children) => treeRow(model, children, 0));
/**
 * Shows a line <tr> for search mode (no indentation)
 * @param {Object} model
 * @return {vnode}
 */
function searchRows(model) {
  return model.object.searchResult.map((item) => {
    const path = item.name;

    /**
     * Select `item` when clicked by user to show its preview
     * @return {Any}
     */
    const selectItem = () => model.object.select(item);
    const color = item.quality === 'good' ? 'success' : 'danger';
    const className = item && item === model.object.selected ? 'table-primary' : '';

    return h('tr', {key: path, title: path, onclick: selectItem, class: className}, [
      h('td.highlight', [
        iconBarChart(),
        ' ',
        item.name
      ]),
      h('td.highlight', {class: color}, item.quality),
    ]);
  });
}

/**
 * Shows a line <tr> of object represented by parent node `tree`, also shows
 * sub-nodes of `tree` as additionnals lines if they are open in the tree.
 * Indentation is added according to tree level during recurcive call of treeRow
 * Tree is traversed in depth-first with pre-order (root then subtrees)
 * @param {Object} model
 * @param {ObjectTree} tree - data-structure containaing an object per node
 * @param {number} level - used for indentation within recurcive call of treeRow
 * @return {vnode}
 */
function treeRow(model, tree, level) {
  // Don't show nodes without IS in online mode
  if (model.object.onlineMode && !tree.informationService) {
    return null;
  }

  const color = tree.quality === 'good' ? 'success' : 'danger';
  const padding = `${level}em`;
  const levelDeeper = level + 1;
  const icon = tree.object ? iconBarChart() : (tree.open ? iconCaretBottom() : iconCaretRight()); // 1 of 3 icons
  const iconWrapper = h('span', {style: {paddingLeft: padding}}, icon);
  const childrens = tree.open ? tree.childrens.map((children) => treeRow(model, children, levelDeeper)) : [];
  const path = tree.path.join('/');
  const selectItem = tree.object ? () => model.object.select(tree.object) : () => tree.toggle();
  const className = tree.object && tree.object === model.object.selected ? 'table-primary' : '';

  return [
    h('tr', {key: path, title: path, onclick: selectItem, class: className}, [
      h('td.highlight', [
        iconWrapper,
        ' ',
        tree.name
      ]),
      h('td.highlight', {class: color}, tree.quality),
    ]),
    ...childrens
  ];
}
