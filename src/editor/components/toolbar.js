/**
 * Toolbar above the canvas: add element, undo and redo; the attendee
 * pagination; the save state, Preview badge and Generate PDF.
 *
 * Adding elements, undo, the pagination and the PDF arrive in later
 * milestones: their controls are shown disabled.
 */
import { Button } from '@wordpress/components';
import { plus, undo, redo, chevronLeft, chevronRight } from '@wordpress/icons';

const SAVE_LABELS = {
	saved: 'Saved',
	unsaved: 'Unsaved changes',
	saving: 'Saving…',
	error: 'Not saved',
};

function Pager( { attendees } ) {
	const total = attendees ? attendees.length : 0;
	const first = total ? attendees[ 0 ] : null;
	return (
		<nav className="ctbg-pager" aria-label="Attendees">
			<Button
				size="small"
				icon={ chevronLeft }
				label="Previous attendee"
				disabled
			/>
			<input
				className="ctbg-pager__number"
				type="number"
				aria-label="Attendee number"
				value={ total ? 1 : 0 }
				disabled
				readOnly
			/>
			<span className="ctbg-pager__total">of { total }</span>
			<Button
				size="small"
				icon={ chevronRight }
				label="Next attendee"
				disabled
			/>
			<span className="ctbg-pager__name">
				{ first
					? first.firstName + ' ' + first.lastName
					: 'No attendees' }
			</span>
		</nav>
	);
}

export function Toolbar( { attendees, saveStatus, saveError } ) {
	return (
		<div className="ctbg-toolbar">
			<Button
				className="ctbg-toolbar__add"
				variant="primary"
				icon={ plus }
				label="Add element"
				size="compact"
				disabled
			/>
			<Button icon={ undo } label="Undo" size="compact" disabled />
			<Button icon={ redo } label="Redo" size="compact" disabled />
			<span className="ctbg-toolbar__spacer" />
			<Pager attendees={ attendees } />
			<span className="ctbg-toolbar__spacer" />
			<span
				className={ 'ctbg-toolbar__status is-' + saveStatus }
				title={ saveError || undefined }
				role="status"
			>
				{ SAVE_LABELS[ saveStatus ] }
			</span>
			<Button variant="secondary" disabled>
				Preview badge
			</Button>
			<Button variant="primary" disabled>
				Generate PDF
			</Button>
		</div>
	);
}
