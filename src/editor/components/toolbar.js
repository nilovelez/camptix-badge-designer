/**
 * Toolbar above the canvas: add element, undo and redo; the attendee
 * pagination; the save state, Preview badge and Generate PDF.
 */
import { useEffect, useState } from '@wordpress/element';
import { Button, DropdownMenu } from '@wordpress/components';
import {
	plus,
	undo,
	redo,
	chevronLeft,
	chevronRight,
	typography,
	image,
	grid,
} from '@wordpress/icons';

const SAVE_LABELS = {
	saved: 'Saved',
	unsaved: 'Unsaved changes',
	saving: 'Saving…',
	error: 'Not saved',
};

function Pager( { attendees, index, onChange } ) {
	const total = attendees.length;
	const attendee = attendees[ index ];
	const [ text, setText ] = useState( String( index + 1 ) );

	useEffect( () => setText( String( index + 1 ) ), [ index ] );

	function go( number ) {
		const clamped = Math.min( total, Math.max( 1, number ) );
		onChange( clamped - 1 );
	}

	return (
		<nav className="ctbg-pager" aria-label="Attendees">
			<Button
				size="small"
				icon={ chevronLeft }
				label="Previous attendee"
				disabled={ index <= 0 }
				onClick={ () => go( index ) }
			/>
			<input
				className="ctbg-pager__number"
				type="number"
				min="1"
				max={ total }
				aria-label="Attendee number"
				value={ text }
				onChange={ ( event ) => {
					setText( event.target.value );
					const number = parseInt( event.target.value, 10 );
					if ( number >= 1 && number <= total ) {
						go( number );
					}
				} }
				onBlur={ () => setText( String( index + 1 ) ) }
			/>
			<span className="ctbg-pager__total">of { total }</span>
			<Button
				size="small"
				icon={ chevronRight }
				label="Next attendee"
				disabled={ index >= total - 1 }
				onClick={ () => go( index + 2 ) }
			/>
			<span
				className="ctbg-pager__name"
				title={ attendee.firstName + ' ' + attendee.lastName }
			>
				{ attendee.firstName } { attendee.lastName }
			</span>
		</nav>
	);
}

export function Toolbar( {
	attendees,
	attendeeIndex,
	onAttendee,
	onAdd,
	onUndo,
	onRedo,
	history,
	saveStatus,
	saveError,
	onPreview,
	onGenerate,
} ) {
	return (
		<div className="ctbg-toolbar">
			<DropdownMenu
				className="ctbg-toolbar__add"
				icon={ plus }
				label="Add element"
				toggleProps={ { variant: 'primary', size: 'compact' } }
				controls={ [
					{
						title: 'Text box',
						icon: typography,
						onClick: () => onAdd( 'text' ),
					},
					{
						title: 'Gravatar',
						icon: image,
						onClick: () => onAdd( 'gravatar' ),
					},
					{
						title: 'QR code: profile',
						icon: grid,
						onClick: () => onAdd( 'qr' ),
					},
				] }
			/>
			<Button
				icon={ undo }
				label="Undo"
				shortcut="Ctrl+Z"
				size="compact"
				disabled={ ! history.canUndo }
				onClick={ onUndo }
			/>
			<Button
				icon={ redo }
				label="Redo"
				shortcut="Ctrl+Shift+Z"
				size="compact"
				disabled={ ! history.canRedo }
				onClick={ onRedo }
			/>
			{ /* Left-aligned, so it does not move with the length of the name. */ }
			<span className="ctbg-toolbar__gap" />
			<Pager
				attendees={ attendees }
				index={ attendeeIndex }
				onChange={ onAttendee }
			/>
			<span className="ctbg-toolbar__spacer" />
			<span
				className={ 'ctbg-toolbar__status is-' + saveStatus }
				title={ saveError || undefined }
				role="status"
			>
				{ SAVE_LABELS[ saveStatus ] }
			</span>
			<Button variant="secondary" onClick={ onPreview }>
				Preview badge
			</Button>
			<Button variant="primary" onClick={ onGenerate }>
				Generate PDF
			</Button>
		</div>
	);
}
