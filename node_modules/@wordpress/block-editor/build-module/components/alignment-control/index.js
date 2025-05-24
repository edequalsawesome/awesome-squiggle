import _extends from "@babel/runtime/helpers/esm/extends";
import { createElement } from "@wordpress/element";

/**
 * Internal dependencies
 */
import AlignmentUI from './ui';

const AlignmentControl = props => {
  return createElement(AlignmentUI, _extends({}, props, {
    isToolbar: false
  }));
};

const AlignmentToolbar = props => {
  return createElement(AlignmentUI, _extends({}, props, {
    isToolbar: true
  }));
};
/**
 * @see https://github.com/WordPress/gutenberg/blob/HEAD/packages/block-editor/src/components/alignment-control/README.md
 */


export { AlignmentControl, AlignmentToolbar };
//# sourceMappingURL=index.js.map