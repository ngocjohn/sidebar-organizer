import { css } from 'lit';

export const dialogStyles = css`
  :host *[hidden] {
    display: none;
  }
  :host #customSelectorHidden {
    --grid-flex-columns: repeat(auto-fill, minmax(30.5%, 1fr));
  }
  :host #customSelector {
    --grid-flex-columns: repeat(auto-fill, minmax(40.5%, 1fr));
  }
  @media all and (max-width: 700px), all and (max-height: 500px) {
    :host #customSelectorHidden,
    :host #customSelector {
      --grid-flex-columns: repeat(auto-fill, minmax(30.5%, 1fr));
    }
  }

  .config-content {
    display: flex;
    flex-direction: column;
    gap: var(--side-dialog-gutter);
    margin-top: 1rem;
    min-height: 250px;
  }

  .group-list {
    /* border-block: solid 1px var(--divider-color); */
    border-block: 0.5px solid var(--divider-color);
    --mdc-icon-button-size: 42px;
  }

  .group-item-row {
    position: relative;
    /* width: 100%; */
    justify-content: space-between;
    display: flex;
    align-items: center;
    margin-block: var(--side-dialog-gutter);
  }

  .group-item-row .handle {
    cursor: grab;
    color: var(--secondary-text-color);
    margin-inline-end: var(--side-dialog-padding);
    flex: 0 0 42px;
  }
  .group-name {
    flex: 1 1 auto;
    gap: var(--side-dialog-padding);
    display: flex;
    align-items: center;
  }
  .group-name:hover {
    cursor: pointer;
    color: var(--primary-color);
  }
  .group-name > ha-icon {
    color: var(--secondary-text-color);
  }
  .group-name-items {
    display: flex;
    flex-direction: column;
  }

  .group-name-items span {
    font-size: 0.8rem;
    color: var(--secondary-text-color);
    line-height: 0.8rem;
  }

  .group-actions {
    display: flex;
    /* gap: 8px; */
    align-items: center;
    /* opacity: 1 !important; */
    margin-inline: var(--side-dialog-gutter);
    color: var(--secondary-text-color);
  }
  .header-row {
    display: inline-flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    --mdc-icon-button-size: 42px;
    height: auto;
  }
  .header-row.center {
    justify-content: center;
  }
  .header-row.flex-end {
    justify-content: flex-end;
  }

  .header-row.flex-icon {
    justify-content: flex-end;
    background-color: var(--divider-color);
    min-height: 42px;
  }
  .header-row.flex-icon > span {
    margin-inline-start: 0.5rem;
    flex: 1;
  }
  .header-row.flex-icon > ha-icon {
    margin-inline-end: 0.5rem;
    flex: 0;
  }

  .sortable-ghost {
    opacity: 0.5;
    background-color: var(--primary-color);
  }

  #items-preview-wrapper {
    display: flex;
    flex-direction: row;
    gap: var(--side-dialog-gutter);
    justify-content: center;
  }
  @media all and (max-width: 700px), all and (max-height: 500px) {
    #items-preview-wrapper {
      flex-wrap: wrap;
    }
  }
  .items-container {
    display: block;
    border: 1px solid var(--divider-color);
    flex: 1 1 100%;
    height: 100%;
  }
  .preview-container {
    min-width: 230px;
    display: flex;
    flex-direction: column;
    width: 100%;
    border: 1px solid var(--divider-color);
    /* display: block; */
  }
  ul.selected-items {
    list-style-type: none;
    padding-inline-start: 0px;
    font-family: monospace;
    color: var(--codemirror-atom);
    text-align: center;
    line-height: 150%;
    margin: 0;
  }
  ul.selected-items li {
    padding: 0.5rem;
    border-bottom: 0.5px solid var(--divider-color);
    display: flex;
    align-items: anchor-center;
  }
  ul.selected-items li:last-child {
    border-bottom: none;
  }

  ul.selected-items li .handle {
    cursor: grab;
    flex: 0 0 42px;
    color: var(--secondary-text-color);
    margin-inline-end: var(--side-dialog-padding);
  }
  ul.selected-items li .handle:hover {
    cursor: grabbing;
  }

  code {
    font-family: monospace;
    background-color: var(--code-editor-background-color);
    color: var(--codemirror-atom);
    border: 0.5px solid var(--divider-color);
    padding: 2px 4px;
    font-size: inherit;
    text-align: center;
    line-height: 150%;
  }

  pre.rendered {
    clear: both;
    white-space: pre-wrap;
    background-color: var(--secondary-background-color);
    padding: 8px;
    margin-top: 0px;
    margin-bottom: 0px;
    direction: ltr;
    overflow: auto;
    max-height: calc(var(--code-mirror-max-height) - 30px);
  }
`;
