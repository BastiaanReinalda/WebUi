import {h} from '/js/src/index.js';

/**
 * Shows a list of layouts
 * @param {Object} model
 * @return {vnode}
 */
export default function layouts(model) {
  return h('.scroll-y.absolute-fill', [
    table(model)
  ]);
}

/**
 * Shows a table containging layouts, one per line
 * @param {Object} model
 * @return {vnode}
 */
function table(model) {
  return [
    h('table.table',
      [
        h('thead',
          h('tr',
            [
              h('th',
                'Name'
              ),
              h('th',
                'Owner'
              ),
              h('th',
                'Popularity'
              )
            ]
          )
        ),
        h('tbody',
          rows(model)
        )
      ]
    )
  ];
}

/**
 * Shows layouts as table lines
 * @param {Object} model
 * @return {vnode}
 */
function rows(model) {
  return (model.layout.searchResult || model.layout.list).map((layout) => {
    const key = `key${layout.name}`;

    return h('tr', {key: key},
      [
        h('td.w-33',
          [
            h('svg.icon', {fill: 'currentcolor', viewBox: '0 0 8 8'},
              h('path', {d: 'M0 0v7h8v-1h-7v-6h-1zm5 0v5h2v-5h-2zm-3 2v3h2v-3h-2z'})
            ),
            ' ',
            h('a', {
              href: `?page=layoutShow&layoutId=${layout.id}&layoutName=${layout.name}`,
              onclick: (e) => model.router.handleLinkEvent(e)
            }, layout.name)
          ]
        ),
        h('td',
          layout.owner_name
        ),
        h('td',
          layout.popularity
        )
      ]
    );
  });
}
