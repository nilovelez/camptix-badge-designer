/**
 * The attendee list as the server sends it, so the order, the names and
 * the missing usernames can be reviewed.
 */
import { useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { SelectControl } from '@wordpress/components';

const cellStyle = { whiteSpace: 'nowrap' };

function Summary( { data } ) {
	const { stats, attendees, questions, source } = data;
	const skipped = Object.entries( stats.skippedByStatus );
	const variables = [
		__( 'First name', 'camptix-badge-designer' ),
		__( 'Last name', 'camptix-badge-designer' ),
		__( 'Full name', 'camptix-badge-designer' ),
		__( 'WordPress.org username', 'camptix-badge-designer' ),
		...questions.map( ( q ) => q.label ),
	];
	return (
		<ul
			style={ { margin: '0 0 16px', listStyle: 'disc', paddingLeft: 20 } }
		>
			<li>
				{ sprintf(
					/* translators: 1: data source, 2: number of rows. */
					_n(
						'Source: %1$s, %2$d row read.',
						'Source: %1$s, %2$d rows read.',
						stats.rows,
						'camptix-badge-designer'
					),
					source,
					stats.rows
				) }
			</li>
			<li>
				<strong>
					{ sprintf(
						/* translators: %d: number of badges. */
						_n(
							'%d badge',
							'%d badges',
							attendees.length,
							'camptix-badge-designer'
						),
						attendees.length
					) }
				</strong>
				{ ', ' +
					__(
						'in purchase order (Attendee ID).',
						'camptix-badge-designer'
					) }
			</li>
			{ skipped.length > 0 && (
				<li>
					{ sprintf(
						/* translators: %s: list of ticket statuses with their counts. */
						__(
							'Left out by ticket status: %s.',
							'camptix-badge-designer'
						),
						skipped
							.map( ( [ status, n ] ) => status + ' (' + n + ')' )
							.join( ', ' )
					) }
				</li>
			) }
			{ stats.placeholders > 0 && (
				<li>
					{ sprintf(
						/* translators: %d: number of tickets. */
						__(
							'Tickets bought for an unknown attendee, left out until claimed: %d.',
							'camptix-badge-designer'
						),
						stats.placeholders
					) }
				</li>
			) }
			{ stats.malformed > 0 && (
				<li>
					{ sprintf(
						/* translators: %d: number of rows. */
						__(
							'Malformed rows skipped: %d.',
							'camptix-badge-designer'
						),
						stats.malformed
					) }
				</li>
			) }
			<li>
				{ sprintf(
					/* translators: %d: number of attendees. */
					__(
						'Without a valid WordPress.org username, so without QR code: %d.',
						'camptix-badge-designer'
					),
					stats.withoutUsername
				) }
			</li>
			<li>
				{ sprintf(
					/* translators: %d: number of attendees. */
					__(
						'Without a valid email address, so without Gravatar: %d.',
						'camptix-badge-designer'
					),
					stats.withoutEmail
				) }
			</li>
			<li>
				{ sprintf(
					/* translators: %d: number of names. */
					__(
						'Names with their case normalized: %d.',
						'camptix-badge-designer'
					),
					stats.namesNormalized
				) }
			</li>
			<li>
				{ sprintf(
					/* translators: %s: list of variable names. */
					__( 'Variables: %s.', 'camptix-badge-designer' ),
					variables.join( ', ' )
				) }
			</li>
		</ul>
	);
}

export function AttendeesList( { data } ) {
	const [ filter, setFilter ] = useState( 'all' );

	let rows = data.attendees;
	if ( filter === 'no-username' ) {
		rows = rows.filter( ( a ) => ! a.username );
	} else if ( filter === 'long' ) {
		rows = [ ...rows ]
			.sort(
				( a, b ) =>
					( b.firstName + b.lastName ).length -
					( a.firstName + a.lastName ).length
			)
			.slice( 0, 20 );
	}
	return (
		<>
			<Summary data={ data } />
			<SelectControl
				__next40pxDefaultSize
				__nextHasNoMarginBottom
				label={ __( 'Show', 'camptix-badge-designer' ) }
				value={ filter }
				options={ [
					{
						label: __( 'All attendees', 'camptix-badge-designer' ),
						value: 'all',
					},
					{
						label: __(
							'Without username (no QR code)',
							'camptix-badge-designer'
						),
						value: 'no-username',
					},
					{
						label: __(
							'The 20 longest names',
							'camptix-badge-designer'
						),
						value: 'long',
					},
				] }
				onChange={ setFilter }
			/>
			<div style={ { maxHeight: 480, overflow: 'auto', marginTop: 12 } }>
				<table className="widefat striped">
					<thead>
						<tr>
							<th>#</th>
							<th>
								{ __(
									'Attendee ID',
									'camptix-badge-designer'
								) }
							</th>
							<th>
								{ __( 'First name', 'camptix-badge-designer' ) }
							</th>
							<th>
								{ __( 'Last name', 'camptix-badge-designer' ) }
							</th>
							<th>
								{ __(
									'Username (QR)',
									'camptix-badge-designer'
								) }
							</th>
							<th>
								{ __( 'Gravatar', 'camptix-badge-designer' ) }
							</th>
							{ data.questions.map( ( q ) => (
								<th key={ q.key }>{ q.label }</th>
							) ) }
						</tr>
					</thead>
					<tbody>
						{ rows.map( ( a ) => (
							<tr key={ a.attendeeId }>
								<td>{ a.number }</td>
								<td>{ a.attendeeId }</td>
								<td style={ cellStyle }>{ a.firstName }</td>
								<td style={ cellStyle }>{ a.lastName }</td>
								<td>{ a.username || '—' }</td>
								<td>
									{ a.gravatarHash
										? __( 'Yes', 'camptix-badge-designer' )
										: '—' }
								</td>
								{ data.questions.map( ( q ) => (
									<td key={ q.key }>
										{ a.answers[ q.key ] }
									</td>
								) ) }
							</tr>
						) ) }
					</tbody>
				</table>
			</div>
		</>
	);
}
