export const DIVIDER_ADDED_STYLE = `
			:host .collapse-toggle {
				color: var(--primary-color);
				transition: transform 0.3s ease;
				cursor: pointer;
				opacity: 0.5;
				margin-right: 4px;
			}
			:host .collapse-toggle.active {
				color: var(--sidebar-icon-color);
				transform: rotate(90deg);
				transition: transform 0.3s ease;
			}
			:host .collapse-toggle:hover {
				color: var(--primary-color);
				opacity: 1;
			}

			:host([expanded]) .title.toggle {
				display: flex !important;
				justify-content: space-between;
				margin: 0;
			}

			:host .divider[added] {
				padding: 0;
				box-sizing: border-box;
				margin: var(--divider-margin-radius);
				width: 248px;
			}
			:host(:not([expanded])) .divider[added]  {
				margin: 0 !important;
			}

			:host([expanded]) .ha-scrollbar .divider[ungrouped] {
				padding-top: 0;
			}

			:host .divider[added] .added-content {
				display: flex;
				justify-content: flex-start;
				align-items: center;
				color: var(--side-divider-text-color, var(--sidebar-text-color));
				background-color: var(--divider-bg-color);
				letter-spacing: 1px;
				font-size: 1.1rem;
				cursor: pointer;
				transition: background-color 0.2s ease;
				border-top: 1px solid var(--divider-border-top-color);
				border-radius: var(--divider-border-radius, none);
				box-sizing: border-box;
				padding-left: 12px;
				padding-inline-end: initial;
				min-height: 40px;
				text-transform: capitalize;
				&:hover {
					color: var(--primary-color);
					background-color: rgb(from var(--primary-color) r g b / 0.1);
				};
			}

			:host .divider.collapsed[added][aria-selected="true"] {
				background-color: rgb(from var(--sidebar-selected-icon-color) r g b / 0.12);
			}

			:host .divider[added] .added-content > span,
			:host .divider[added] .added-content > ha-icon {
				pointer-events: none;
				transition: all 150ms ease;
			}

			:host .divider[added] .added-content.collapsed > ha-icon {
				transform: rotate(-90deg);
			}

			:host .divider[added] .added-content > span {
				transform: translateX(30px);
			}
			:host .divider[added]:hover .added-content.collapsed > span {
				transform: translateX(30px);

			}
			:host .divider[added] .added-content.collapsed > span {
				transform: translateX(10px);
			}

			:host([expanded]) .ha-scrollbar .divider[added]::before {
				display: none !important;
			}

			:host(:not([expanded])) .divider.collapsed[added]::before {
				content: "";
				display: none;
			}

			:host(:not([expanded])) .divider .added-content {
				display: none;
			}

			a:not(.iron-selected):hover > paper-icon-item {
				background-color: rgb(from var(--sidebar-selected-icon-color) r g b / 0.2);
			}

			:host a.collapsed {
				max-height: 0px;
				overflow: hidden;
			}

			:host a.configuration-container[aria-selected="false"]::before {
				display: none;
			}

			:host(:not([expanded])) a.collapsed.iron-selected {
				max-height: 1000px;
			}

			:host a.slideIn {
				animation-name: slideIn;
				animation-duration: 0.3s;
				animation-fill-mode: both;
			}

			@keyframes slideIn {
				from {
					max-height: 0px;
					opacity: 0.3;
				}
				to {
					max-height: 1000px;
					opacity: 1;
				}
			}

			:host a.slideOut {
				animation-name: slideOut;
				animation-duration: 0.3s;
				animation-fill-mode: both;
			}
			@keyframes slideOut {
				from {
					max-height: 1000px;
					opacity: 1;
				}
				to {
					max-height: 0px;
					opacity: 0;
				}
			}
	`;

export const DIALOG_STYLE = `

		ha-dialog {
			--mdc-dialog-min-width: 600px;
			--mdc-dialog-max-width: 700px;
			--mdc-dialog-min-height: 450px;
			--dialog-backdrop-filter: blur(2px);
			--justify-action-buttons: space-between;
			--dialog-content-padding: 1rem;
		}
		ha-dialog[large] {
			--mdc-dialog-min-width: 90vw;
			--mdc-dialog-max-width: 90vw;
		}
		@media all and (max-width: 600px), all and (max-height: 500px) {
			ha-dialog,
			ha-dialog[large] {
				--mdc-dialog-min-width: 100vw;
				--mdc-dialog-max-width: 100vw;
				--mdc-dialog-min-height: 100%;
				--mdc-dialog-max-height: 100%;
				--vertical-align-dialog: flex-end;
				--ha-dialog-border-radius: 0;
			}
		}
`;
